// Supabase Edge Function: /functions/v1/voz
// Recebe um áudio curto (até 30 s), transcreve com Groq Whisper e devolve
// lançamentos financeiros (modo "financeiro") ou tarefas (modo "tarefas")
// em JSON validado por schema.
//
// Segredos necessários (supabase secrets set ...):
//   GROQ_API_KEY      chave da Groq (nunca vai para o front-end)
//   VOZ_LIMITE_DIA    opcional, padrão 200 gravações por usuário por dia
// Variáveis já disponíveis em toda Edge Function: SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from "npm:@supabase/supabase-js@2";

const GROQ_URL = "https://api.groq.com/openai/v1";
const MODELO_TRANSCRICAO = "whisper-large-v3-turbo";
const MODELO_INTERPRETACAO = "openai/gpt-oss-20b"; // suporta json_schema com strict
const TAMANHO_MAX = 4 * 1024 * 1024; // 4 MB sobra para 30 s de webm/opus

const CORS = {
  "Access-Control-Allow-Origin": "*", // troque pelo domínio do GitHub Pages em produção
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ---------- Schemas de saída (strict: todo campo em required, opcional = null) ----------
const SCHEMA_FINANCEIRO = {
  type: "object",
  additionalProperties: false,
  required: ["itens"],
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "descricao", "valor", "categoria", "parcelas", "forma_pagamento", "data"],
        properties: {
          tipo: { type: "string", enum: ["gasto", "entrada", "investimento", "conta_fixa"] },
          descricao: { type: "string" },
          valor: { type: "number" },
          categoria: { type: ["string", "null"] },
          parcelas: { type: "integer" },
          forma_pagamento: { type: "string", enum: ["pix", "debito", "credito", "dinheiro", "nao_informado"] },
          data: { type: ["string", "null"] }, // AAAA-MM-DD quando a pessoa disser "ontem", "dia 5"...
        },
      },
    },
  },
};

const SCHEMA_TAREFAS = {
  type: "object",
  additionalProperties: false,
  required: ["tarefas"],
  properties: {
    tarefas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "nota", "prioridade", "data"],
        properties: {
          titulo: { type: "string" },
          nota: { type: ["string", "null"] },
          prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
          data: { type: ["string", "null"] },
        },
      },
    },
  },
};

function promptFinanceiro(hoje: string, catGasto: string[], catInvest: string[]) {
  return [
    "Você converte uma fala em português do Brasil em lançamentos financeiros.",
    `Hoje é ${hoje} (fuso America/Sao_Paulo).`,
    "Regras:",
    "- Um item por valor citado. Sem valor explícito, não crie o item.",
    "- tipo: 'gasto' (compras, pagamentos do dia a dia), 'entrada' (salário, recebi, vendi, pix recebido),",
    "  'investimento' (apliquei, investi, guardei, aportei; resgate = valor negativo),",
    "  'conta_fixa' (aluguel, assinatura, mensalidade, conta de luz, quando a pessoa disser que é fixa/mensal).",
    "- valor em reais, número positivo (exceto resgate). 'cinquenta e dois e noventa' = 52.90.",
    "- descricao curta, com inicial maiúscula, sem o valor (ex.: 'Mercado', 'Uber', 'Salário').",
    `- categoria: escolha EXATAMENTE uma desta lista para gasto/conta_fixa: ${JSON.stringify(catGasto)};`,
    `  para investimento: ${JSON.stringify(catInvest)}; para entrada use null.`,
    "- parcelas: 1 se à vista; 'em 3x' = 3 (máximo 12).",
    "- forma_pagamento: pix, debito, credito ou dinheiro quando dito; senão 'nao_informado'.",
    "- data: AAAA-MM-DD se a pessoa disser o dia ('ontem', 'dia 5'); senão null.",
    "Responda só com o JSON do schema.",
  ].join("\n");
}

function promptTarefas(hoje: string) {
  return [
    "Você converte uma fala em português do Brasil em uma lista de tarefas.",
    `Hoje é ${hoje} (fuso America/Sao_Paulo).`,
    "- Separe cada ação em uma tarefa. titulo curto e no imperativo ('Ligar para o contador').",
    "- Detalhes falados sobre a tarefa vão em nota; sem detalhes, nota = null.",
    "- prioridade 'alta' se disser urgente/importante/hoje sem falta; 'baixa' se disser quando der; senão 'media'.",
    "- data AAAA-MM-DD se citar o dia ('amanhã', 'sexta'); senão null.",
    "Responda só com o JSON do schema.",
  ].join("\n");
}

function hojeSaoPaulo() {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) return json({ erro: "GROQ_API_KEY não configurada" }, 500);

  // 1) Usuário autenticado (o front envia o access_token do Supabase)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ erro: "Faça login para usar a voz" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ erro: "Sessão inválida" }, 401);
  const userId = userData.user.id;

  // 2) Limite diário (protege a sua cota na Groq)
  const limite = Number(Deno.env.get("VOZ_LIMITE_DIA") ?? "200");
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("voz_uso")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", desde);
  if ((count ?? 0) >= limite) return json({ erro: "Limite diário de gravações atingido" }, 429);

  // 3) Lê o formulário: audio (Blob), modo, categorias_gasto, categorias_investimento
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ erro: "Envie multipart/form-data com o campo 'audio'" }, 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return json({ erro: "Áudio vazio" }, 400);
  if (audio.size > TAMANHO_MAX) return json({ erro: "Áudio grande demais (máx. 30 s)" }, 413);

  const modo = form.get("modo") === "tarefas" ? "tarefas" : "financeiro";
  const parseLista = (campo: string, padrao: string[]) => {
    try {
      const v = JSON.parse(String(form.get(campo) ?? "[]"));
      return Array.isArray(v) && v.length ? v.map(String).slice(0, 40) : padrao;
    } catch {
      return padrao;
    }
  };
  const catGasto = parseLista("categorias_gasto", ["Alimentação", "Casa", "Saúde", "Lazer", "Transporte", "Outros"]);
  const catInvest = parseLista("categorias_investimento", ["Renda fixa", "Ações e FIIs", "Cripto", "Reserva"]);

  // 4) Transcrição
  const fd = new FormData();
  fd.append("file", audio, audio.name || "audio.webm");
  fd.append("model", MODELO_TRANSCRICAO);
  fd.append("language", "pt");
  fd.append("response_format", "json");
  fd.append("temperature", "0");

  const tr = await fetch(`${GROQ_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: fd,
  });
  if (tr.status === 429 || tr.status === 503) return json({ erro: "IA ocupada, tente em alguns segundos" }, 503);
  if (!tr.ok) return json({ erro: "Falha na transcrição", detalhe: await tr.text() }, 502);
  const transcricao = String((await tr.json()).text ?? "").trim();

  await supabase.from("voz_uso").insert({ user_id: userId, modo, ok: Boolean(transcricao) });

  if (!transcricao) {
    return json(modo === "tarefas" ? { transcricao, tarefas: [] } : { transcricao, itens: [] });
  }

  // 5) Interpretação com saída estruturada
  const hoje = hojeSaoPaulo();
  const chat = await fetch(`${GROQ_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELO_INTERPRETACAO,
      temperature: 0,
      messages: [
        { role: "system", content: modo === "tarefas" ? promptTarefas(hoje) : promptFinanceiro(hoje, catGasto, catInvest) },
        { role: "user", content: transcricao },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: modo === "tarefas" ? "tarefas" : "lancamentos",
          strict: true,
          schema: modo === "tarefas" ? SCHEMA_TAREFAS : SCHEMA_FINANCEIRO,
        },
      },
    }),
  });
  if (chat.status === 429 || chat.status === 503) return json({ erro: "IA ocupada, tente em alguns segundos" }, 503);
  if (!chat.ok) {
    // Devolve a transcrição para o front cair no modo manual
    return json(modo === "tarefas" ? { transcricao, tarefas: null } : { transcricao, itens: [] }, 200);
  }

  let saida: Record<string, unknown> = {};
  try {
    saida = JSON.parse((await chat.json()).choices?.[0]?.message?.content ?? "{}");
  } catch {
    saida = {};
  }

  if (modo === "tarefas") {
    return json({ transcricao, tarefas: Array.isArray(saida.tarefas) ? saida.tarefas : null });
  }

  // Saneamento final: valores > 0 (exceto resgate), parcelas 1..12, categoria válida
  const itens = (Array.isArray(saida.itens) ? saida.itens : [])
    .map((i: any) => ({
      ...i,
      valor: Math.round(Number(i.valor) * 100) / 100,
      parcelas: Math.min(12, Math.max(1, Math.trunc(Number(i.parcelas) || 1))),
      categoria:
        i.tipo === "entrada"
          ? null
          : [...catGasto, ...catInvest].includes(i.categoria) ? i.categoria : null,
    }))
    .filter((i: any) => Number.isFinite(i.valor) && i.valor !== 0 && (i.valor > 0 || i.tipo === "investimento"));

  return json({ transcricao, itens });
});
