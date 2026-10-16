// Regras da importação de extratos (docs/07-importacao.md). Puras, testadas; valores em centavos.

import { normalizar } from "./categorizar";
import { parseData } from "./datas";

export type LinhaExtrato = {
  /** AAAA-MM-DD */
  data: string;
  /** Centavos com sinal: crédito > 0, débito < 0. */
  centavos: number;
  descricao: string;
  fitid: string | null;
};

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Chave de cada linha para não importar duas vezes (guardada por conta no banco).
 * OFX: "ofx:<FITID>". Sem FITID: "h:<sha256 conta|data|centavos|descrição normalizada>".
 * Repetições idênticas no mesmo arquivo ganham "#2", "#3"… (dois cafés iguais no mesmo dia
 * continuam sendo dois), e o mesmo arquivo sempre gera as mesmas chaves.
 */
export async function chavesDasLinhas(contaId: string, linhas: LinhaExtrato[]): Promise<string[]> {
  const vistas = new Map<string, number>();
  const chaves: string[] = [];
  for (const l of linhas) {
    const base = l.fitid
      ? `ofx:${l.fitid}`
      : `h:${await sha256([contaId, l.data, l.centavos, normalizar(l.descricao)].join("|"))}`;
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    chaves.push(n === 1 ? base : `${base}#${n}`);
  }
  return chaves;
}

export type TipoImportacao = "entrada" | "gasto" | "conta_fixa" | "investimento";

const INVESTIMENTO = /\b(aplicacao|aplic|resgate|resg|cdb|lci|lca|tesouro|poupanca|fundo de investimento|rdb)\b/;

/** Crédito → entrada; débito → gasto; aplicação/resgate → investimento. */
export function sugerirTipo(l: Pick<LinhaExtrato, "centavos" | "descricao">): TipoImportacao {
  if (INVESTIMENTO.test(normalizar(l.descricao))) return "investimento";
  return l.centavos >= 0 ? "entrada" : "gasto";
}

/**
 * Valor gravado na tabela do tipo: entrada/gasto/conta sempre positivo;
 * investimento positivo = aporte (dinheiro saiu da conta), negativo = resgate.
 */
export function valorParaTipo(tipo: TipoImportacao, centavos: number): number {
  return tipo === "investimento" ? -centavos : Math.abs(centavos);
}

export type ContaFixaAberta = { id: string; descricao: string; valor: number | string; pago: boolean; ano: number; mes: number };

/** Débito com o mesmo valor e nome parecido de uma conta fixa não paga do mesmo mês. */
export function contaFixaParecida(l: LinhaExtrato, contas: ContaFixaAberta[], centavosDe: (v: number | string) => number): ContaFixaAberta | null {
  if (l.centavos >= 0) return null;
  const d = parseData(l.data);
  const desc = ` ${normalizar(l.descricao)} `;
  return (
    contas.find((c) => {
      if (c.pago || c.ano !== d.getFullYear() || c.mes !== d.getMonth() + 1) return false;
      if (centavosDe(c.valor) !== -l.centavos) return false;
      const nome = normalizar(c.descricao);
      return nome.length > 0 && (desc.includes(` ${nome} `) || nome.includes(normalizar(l.descricao)));
    }) ?? null
  );
}

const DIA = 86_400_000;
export const diasEntre = (a: string, b: string) => Math.abs(Math.round((parseData(a).getTime() - parseData(b).getTime()) / DIA));

/** Linha nova do lote (já com a conta escolhida). */
export type LinhaParaPar = { id: string; contaId: string; data: string; centavos: number };
/** Entrada (centavos > 0) ou gasto (centavos < 0) já gravado, importado de alguma conta. */
export type LancamentoGravado = { id: string; tabela: "entradas" | "gastos_variaveis"; contaId: string; data: string; centavos: number; descricao: string };
export type TransferenciaGravada = { contaOrigemId: string; contaDestinoId: string; data: string; centavos: number };

export type SugestaoTransferencia =
  /** A outra ponta está no mesmo lote. */
  | { tipo: "lote"; parId: string; outraContaId: string }
  /** A outra ponta já foi gravada como entrada/gasto: vira a transferência (mesmo id). */
  | { tipo: "gravado"; par: LancamentoGravado; outraContaId: string }
  /** Essa transferência já existe: a linha só registra a chave. */
  | { tipo: "ja_registrada" };

/**
 * Pares de transferência entre contas do usuário: mesmo valor, sinais opostos,
 * até 2 dias de diferença e contas diferentes. Cada ponta casa uma vez só;
 * entre candidatas, vence a de data mais próxima.
 */
export function detectarTransferencias(
  linhas: LinhaParaPar[],
  gravados: LancamentoGravado[],
  transferencias: TransferenciaGravada[],
  limiteDias = 2,
): Map<string, SugestaoTransferencia> {
  const r = new Map<string, SugestaoTransferencia>();
  const usadas = new Set<string>();

  const maisProxima = <T extends { data: string }>(data: string, candidatas: T[]) =>
    candidatas.sort((a, b) => diasEntre(a.data, data) - diasEntre(b.data, data))[0];

  // 1) Já registrada como transferência (esta conta saindo ou entrando)
  const transfLivres = [...transferencias];
  for (const l of linhas) {
    const i = transfLivres.findIndex(
      (t) =>
        t.centavos === Math.abs(l.centavos) &&
        diasEntre(t.data, l.data) <= limiteDias &&
        (l.centavos < 0 ? t.contaOrigemId === l.contaId : t.contaDestinoId === l.contaId),
    );
    if (i >= 0) {
      transfLivres.splice(i, 1);
      r.set(l.id, { tipo: "ja_registrada" });
      usadas.add(l.id);
    }
  }

  // 2) Par dentro do lote
  for (const l of linhas) {
    if (usadas.has(l.id)) continue;
    const par = maisProxima(
      l.data,
      linhas.filter(
        (o) => !usadas.has(o.id) && o.id !== l.id && o.contaId !== l.contaId && o.centavos === -l.centavos && l.centavos !== 0 && diasEntre(o.data, l.data) <= limiteDias,
      ),
    );
    if (par) {
      usadas.add(l.id).add(par.id);
      r.set(l.id, { tipo: "lote", parId: par.id, outraContaId: par.contaId });
      r.set(par.id, { tipo: "lote", parId: l.id, outraContaId: l.contaId });
    }
  }

  // 3) Par com lançamento já gravado de outra conta
  const gravadosUsados = new Set<string>();
  for (const l of linhas) {
    if (usadas.has(l.id)) continue;
    const par = maisProxima(
      l.data,
      gravados.filter(
        (g) => !gravadosUsados.has(g.id) && g.contaId !== l.contaId && g.centavos === -l.centavos && l.centavos !== 0 && diasEntre(g.data, l.data) <= limiteDias,
      ),
    );
    if (par) {
      gravadosUsados.add(par.id);
      usadas.add(l.id);
      r.set(l.id, { tipo: "gravado", par, outraContaId: par.contaId });
    }
  }
  return r;
}

/** Código do banco (COMPE) que vem no BANKID do OFX → nome amigável para a conta nova. */
const BANCOS: Record<string, string> = {
  "1": "Banco do Brasil",
  "33": "Santander",
  "77": "Inter",
  "104": "Caixa",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Safra",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function nomeDoBanco(bankid: string | null): string | null {
  if (!bankid) return null;
  return BANCOS[String(Number(bankid.replace(/\D/g, "")))] ?? null;
}
