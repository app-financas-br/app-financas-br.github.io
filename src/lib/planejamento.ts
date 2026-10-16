// Planejamento (docs/06-planejamento.md). Funções puras, tudo em centavos.
// Percentuais trabalham em pontos-base (bp): 1% = 100 bp, 12,5% = 1250 bp, 100% = 10000 bp.

import type { Periodo } from "./datas";
import { paraCentavos } from "./dinheiro";

type Valor = number | string;

/** Percentual do banco (numeric 5,2: número ou string) → pontos-base inteiros. */
export function paraBp(percentual: Valor | null | undefined): number {
  return Math.round(paraCentavos(percentual));
}

/** Pontos-base → número de % para gravar no banco (2 casas). */
export function deBp(bp: number): number {
  return Math.round(bp) / 100;
}

/** "12,5" / "12.5" / "12,5%" → pontos-base; null se inválido ou fora de 0–100. */
export function parsePercentual(texto: string): number | null {
  const s = texto.replace(/[%\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= 10000 ? bp : null;
}

/** Pontos-base → "12,5%" (sem casas desnecessárias). */
export function formatarBp(bp: number): string {
  return `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Previsto de cada grupo = renda × % em centavos, pelo método do maior resto.
 * Cada grupo recebe o piso; os centavos que faltam para chegar a renda × (soma das %)
 * vão, um a um, para os maiores restos (empate: ordem da lista).
 * Com % somando 100, a soma dos previstos é exatamente a renda.
 */
export function previstoPorGrupo(rendaCentavos: number, grupos: { id: string; bp: number }[]): Map<string, number> {
  const renda = BigInt(Math.max(0, Math.round(rendaCentavos)));
  const DEZ_MIL = 10000n;
  const partes = grupos.map((g, ordem) => {
    const exato = renda * BigInt(Math.max(0, Math.round(g.bp)));
    return { id: g.id, ordem, piso: exato / DEZ_MIL, resto: exato % DEZ_MIL };
  });
  const totalBp = BigInt(grupos.reduce((s, g) => s + Math.max(0, Math.round(g.bp)), 0));
  const alvo = (renda * totalBp) / DEZ_MIL;
  let falta = alvo - partes.reduce((s, p) => s + p.piso, 0n);

  const porResto = [...partes].sort((a, b) => (a.resto === b.resto ? a.ordem - b.ordem : a.resto > b.resto ? -1 : 1));
  for (const p of porResto) {
    if (falta <= 0n) break;
    if (p.resto === 0n) break;
    p.piso += 1n;
    falta -= 1n;
  }
  return new Map(partes.map((p) => [p.id, Number(p.piso)]));
}

export type AvisoPercentual = { tipo: "ok" } | { tipo: "faltam"; bp: number } | { tipo: "passou"; bp: number };

/** Total das % diferente de 100: avisa quanto falta ou passou (não bloqueia nada). */
export function avisoPercentual(totalBp: number): AvisoPercentual {
  if (totalBp === 10000) return { tipo: "ok" };
  return totalBp < 10000 ? { tipo: "faltam", bp: 10000 - totalBp } : { tipo: "passou", bp: totalBp - 10000 };
}

export type NivelBarra = "normal" | "atencao" | "estourou";

/** Cor da barra: normal < 80%, atenção de 80% a 100%, estourou acima de 100% (ou gasto sem previsto). */
export function nivelBarra(realizado: number, previsto: number): NivelBarra {
  if (previsto <= 0) return realizado > 0 ? "estourou" : "normal";
  if (realizado > previsto) return "estourou";
  return realizado * 100 >= previsto * 80 ? "atencao" : "normal";
}

const chavePeriodo = ({ ano, mes }: Periodo) => ano * 100 + mes;

/** Plano em vigor no mês: o próprio ou o último salvo antes dele (vira o ano). null se não houver. */
export function planoVigente<P extends Periodo>(planos: P[], periodo: Periodo): P | null {
  const alvo = chavePeriodo(periodo);
  let melhor: P | null = null;
  for (const p of planos) {
    const k = chavePeriodo(p);
    if (k <= alvo && (!melhor || k > chavePeriodo(melhor))) melhor = p;
  }
  return melhor;
}

/** Planos próprios dos meses depois do selecionado (os que "Aplicar aos próximos meses" substitui). */
export function planosFuturos<P extends Periodo>(planos: P[], periodo: Periodo): P[] {
  const alvo = chavePeriodo(periodo);
  return planos.filter((p) => chavePeriodo(p) > alvo);
}

export type CategoriaGrupo = { id: string; grupo_id: string | null };
type Saida = { valor: Valor; pago: boolean; categoria_id: string | null };
type Aporte = { valor: Valor; categoria_id: string | null };

/**
 * Realizado do mês por grupo (chave null = "Sem grupo"), pela ligação categoria → grupo.
 * Contas fixas e gastos respeitam "contar só o que foi pago". Investimentos somam
 * aportes − resgates por grupo, com mínimo 0.
 */
export function realizadoPorGrupo(dados: {
  categorias: CategoriaGrupo[];
  contas: Saida[];
  gastos: Saida[];
  investimentos: Aporte[];
  soPago: boolean;
}): Map<string | null, number> {
  const grupoDe = new Map(dados.categorias.map((c) => [c.id, c.grupo_id]));
  const grupo = (categoriaId: string | null) => (categoriaId ? grupoDe.get(categoriaId) ?? null : null);

  const gastos = new Map<string | null, number>();
  for (const s of [...dados.contas, ...dados.gastos]) {
    if (dados.soPago && !s.pago) continue;
    const g = grupo(s.categoria_id);
    gastos.set(g, (gastos.get(g) ?? 0) + paraCentavos(s.valor));
  }

  const aportes = new Map<string | null, number>();
  for (const i of dados.investimentos) {
    const g = grupo(i.categoria_id);
    aportes.set(g, (aportes.get(g) ?? 0) + paraCentavos(i.valor));
  }

  const total = new Map(gastos);
  for (const [g, v] of aportes) total.set(g, (total.get(g) ?? 0) + Math.max(0, v));
  return total;
}
