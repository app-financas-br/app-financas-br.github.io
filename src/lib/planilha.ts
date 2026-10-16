// Leitura de planilhas (CSV/XLSX já convertidas em linhas de células) para importação.
// Puro e testado: o exceljs fica em features/importacao/xlsx.ts, carregado sob demanda.

import { normalizar } from "./categorizar";
import { paraCentavos } from "./dinheiro";
import { valorOfx } from "./ofx";

export type Celula = string | number | Date | null;

/** Separador mais provável (; , ou tab), contando só fora de aspas nas primeiras linhas. */
export function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 15);
  let melhor = ";";
  let maior = -1;
  for (const sep of [";", ",", "\t"]) {
    const contagens = amostra.map((l) => {
      let n = 0;
      let aspas = false;
      for (const ch of l) {
        if (ch === '"') aspas = !aspas;
        else if (ch === sep && !aspas) n++;
      }
      return n;
    });
    // Separador bom aparece em quase todas as linhas
    const pontos = contagens.filter((n) => n > 0).length * 100 + Math.max(0, ...contagens);
    if (pontos > maior) {
      maior = pontos;
      melhor = sep;
    }
  }
  return melhor;
}

/** CSV (RFC 4180: aspas, aspas dobradas, quebra de linha dentro de aspas) → linhas de texto. */
export function lerCsv(texto: string, sep = detectarSeparador(texto)): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  const s = texto.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (aspas) {
      if (ch === '"' && s[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"' && campo.trim() === "") aspas = true; // aspas só abrem no início do campo
    else if (ch === sep) {
      linha.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += ch;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((c) => c.trim()));
}

export type Campo = "data" | "descricao" | "valor" | "debito" | "credito" | "tipo" | "categoria";
export const CAMPOS: Campo[] = ["data", "descricao", "valor", "debito", "credito", "tipo", "categoria"];
export type Mapeamento = Partial<Record<Campo, number>>;

const texto = (c: Celula) => (c === null ? "" : c instanceof Date ? "" : String(c).trim());
const vazia = (l: Celula[]) => l.every((c) => texto(c) === "" && !(c instanceof Date) && typeof c !== "number");

// Nomes de coluna comuns em planilhas e extratos brasileiros (já normalizados)
const PADROES: [Campo, RegExp][] = [
  ["data", /^(data|dt|date|dia)\b/],
  ["debito", /\b(debito|debitos|saida|saidas|debit)\b/],
  ["credito", /\b(credito|creditos|entrada|entradas|credit)\b/],
  ["valor", /\b(valor|value|amount|quantia|montante)\b/],
  ["descricao", /\b(descricao|historico|lancamento|estabelecimento|titulo|title|memo|detalhe|detalhes|description|identificador)\b/],
  ["tipo", /^(tipo|natureza|type)\b/],
  ["categoria", /^(categoria|category)\b/],
];

/** Sugere a coluna de cada campo pelo nome do cabeçalho; cada coluna serve a um campo só. */
export function sugerirMapeamento(cabecalho: Celula[]): Mapeamento {
  const m: Mapeamento = {};
  const usadas = new Set<number>();
  for (const [campo, re] of PADROES) {
    const i = cabecalho.findIndex((c, idx) => !usadas.has(idx) && re.test(normalizar(texto(c))));
    if (i >= 0) {
      m[campo] = i;
      usadas.add(i);
    }
  }
  // "Valor" sozinho já basta; com débito E crédito, o valor vem dos dois
  if (m.debito !== undefined && m.credito === undefined && m.valor === undefined) {
    m.valor = m.debito;
    delete m.debito;
  }
  return m;
}

/** Mapeamento mínimo: data, descrição e (valor ou débito/crédito). */
export const mapeamentoCompleto = (m: Mapeamento) =>
  m.data !== undefined && m.descricao !== undefined && (m.valor !== undefined || m.debito !== undefined || m.credito !== undefined);

/** Linha do cabeçalho: a primeira (até a 20ª) cujo mapeamento sugerido fica completo; senão a 1ª não vazia. */
export function encontrarCabecalho(linhas: Celula[][]): number {
  const limite = Math.min(linhas.length, 20);
  for (let i = 0; i < limite; i++) if (mapeamentoCompleto(sugerirMapeamento(linhas[i]!))) return i;
  return Math.max(0, linhas.findIndex((l) => !vazia(l)));
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");
function montarData(ano: number, mes: number, dia: number): string | null {
  if (ano < 100) ano += 2000;
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12 || dia < 1 || dia > new Date(ano, mes, 0).getDate()) return null;
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(dia)}`;
}

/**
 * Célula → AAAA-MM-DD. Aceita dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd (com hora ou não),
 * Date do exceljs (que vem em UTC: usa as partes UTC) e número de série do Excel.
 */
export function dataDaCelula(c: Celula): string | null {
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? null : montarData(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate());
  if (typeof c === "number") {
    if (c < 20000 || c > 80000) return null; // 1954…2119
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86_400_000);
    return montarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = texto(c);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return montarData(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/.exec(s);
  if (m) return montarData(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/**
 * Célula → centavos com sinal. Aceita número, "1.234,56", "-52,90", "R$ 10,00", "(10,00)",
 * "10,00-", "10,00 D" (débito) e "10,00 C" (crédito).
 */
export function valorDaCelula(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? paraCentavos(c) : null;
  let s = texto(c).replace(/R\$|\s| /gi, "");
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (/[-]$/.test(s)) {
    negativo = true;
    s = s.slice(0, -1);
  }
  const dc = /([DC])$/i.exec(s);
  if (dc) {
    negativo = dc[1]!.toUpperCase() === "D";
    s = s.slice(0, -1);
  }
  const v = valorOfx(s);
  if (v === null) return null;
  return negativo ? -Math.abs(v) : v;
}

export type TipoPlanilha = "entrada" | "gasto" | "conta_fixa" | "investimento" | "transferencia";

/** Texto da coluna Tipo → tipo do app (null se não reconhecer). */
export function tipoDoTexto(c: Celula): TipoPlanilha | null {
  const s = normalizar(texto(c));
  if (!s) return null;
  if (/\b(conta fixa|fixa|fixo)\b/.test(s)) return "conta_fixa";
  if (/\b(transferencia|transf)\b/.test(s)) return "transferencia";
  if (/\b(investimento|aplicacao|aporte|resgate)\b/.test(s)) return "investimento";
  if (s === "c" || /\b(entrada|receita|credito|recebimento)\b/.test(s)) return "entrada";
  if (s === "d" || /\b(gasto|despesa|saida|debito|pagamento)\b/.test(s)) return "gasto";
  return null;
}

export type LinhaPlanilha = {
  data: string;
  centavos: number;
  descricao: string;
  fitid: null;
  tipo: TipoPlanilha | null;
  categoria: string | null;
};

/**
 * Aplica o mapeamento às linhas abaixo do cabeçalho. Linha vazia é pulada em silêncio;
 * linha com conteúdo mas sem data/valor válidos vai para `ignoradas` (número da linha, a partir de 1).
 * Sinal: débito/crédito em colunas → crédito − débito. Com coluna Tipo, o tipo manda no sinal
 * (gasto/conta fixa/aporte saem, entrada/resgate entram), para planilhas que anotam tudo positivo.
 */
export function aplicarMapeamento(linhas: Celula[][], cabecalho: number, m: Mapeamento): { transacoes: LinhaPlanilha[]; ignoradas: number[] } {
  const transacoes: LinhaPlanilha[] = [];
  const ignoradas: number[] = [];
  const col = (l: Celula[], campo: Campo) => (m[campo] === undefined ? null : l[m[campo]!] ?? null);

  for (let i = cabecalho + 1; i < linhas.length; i++) {
    const l = linhas[i]!;
    if (vazia(l)) continue;
    const data = dataDaCelula(col(l, "data"));

    let centavos: number | null = null;
    if (m.debito !== undefined || m.credito !== undefined) {
      const deb = valorDaCelula(col(l, "debito"));
      const cred = valorDaCelula(col(l, "credito"));
      if (deb !== null || cred !== null) centavos = Math.abs(cred ?? 0) - Math.abs(deb ?? 0);
    }
    if (centavos === null && m.valor !== undefined) centavos = valorDaCelula(col(l, "valor"));

    const tipo = tipoDoTexto(col(l, "tipo"));
    if (centavos !== null && tipo) {
      if (tipo === "gasto" || tipo === "conta_fixa") centavos = -Math.abs(centavos);
      else if (tipo === "entrada") centavos = Math.abs(centavos);
      // Investimento: aporte sai da conta; resgate entra (pela palavra no Tipo ou na descrição)
      else if (tipo === "investimento") {
        const resgate = /\bresgate\b/.test(normalizar(`${texto(col(l, "tipo"))} ${texto(col(l, "descricao"))}`));
        centavos = resgate ? Math.abs(centavos) : -Math.abs(centavos);
      }
      // Transferência: o sinal da planilha manda (negativo = saiu desta conta)
    }

    const descricao = texto(col(l, "descricao")).replace(/\s+/g, " ").slice(0, 200);
    if (!data || centavos === null || centavos === 0) {
      ignoradas.push(i + 1);
      continue;
    }
    const categoria = texto(col(l, "categoria")) || null;
    transacoes.push({ data, centavos, descricao: descricao || "Sem descrição", fitid: null, tipo, categoria });
  }
  return { transacoes, ignoradas };
}

/** Conteúdo do modelo do app (a mesma tabela vira .xlsx). */
export const MODELO = {
  cabecalho: ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
  exemplos: [
    ["05/10/2026", "Salário", 3500, "Entrada", ""],
    ["06/10/2026", "Mercado do bairro", 245.9, "Gasto", "Alimentação"],
    ["10/10/2026", "Aluguel", 1200, "Conta fixa", "Casa"],
    ["12/10/2026", "Aplicação CDB", 500, "Investimento", "Renda fixa"],
  ] as (string | number)[][],
  tipos: ["Entrada", "Gasto", "Conta fixa", "Investimento", "Transferência"],
};
