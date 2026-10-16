// Contas do Dashboard (puras, em centavos). As regras de negócio vêm de calculos.ts.

import { formatarData, parseData, ultimoDiaDoMes, type Periodo } from "./datas";
import { paraCentavos } from "./dinheiro";

type Valor = number | string;

/** Dia do mês (1..último) de uma data AAAA-MM-DD; sem data, ou de outro mês, conta no dia 1. */
export function diaNoPeriodo(data: string | null | undefined, { ano, mes }: Periodo): number {
  if (!data) return 1;
  const d = parseData(data);
  if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) return 1;
  return d.getDate();
}

/** Série acumulada dia a dia (1..último dia do mês), em centavos. */
export function acumuladoDiario(itens: { valor: Valor; dia: number }[], periodo: Periodo): number[] {
  const dias = ultimoDiaDoMes(periodo.ano, periodo.mes);
  const porDia = new Array<number>(dias).fill(0);
  for (const i of itens) porDia[Math.min(Math.max(i.dia, 1), dias) - 1]! += paraCentavos(i.valor);
  let total = 0;
  return porDia.map((v) => (total += v));
}

/** Corta a série no dia de hoje quando o período é o mês atual (o futuro ainda não aconteceu). */
export function ateHoje(serie: number[], periodo: Periodo, hoje: string): number[] {
  const h = parseData(hoje);
  if (h.getFullYear() !== periodo.ano || h.getMonth() + 1 !== periodo.mes) return serie;
  return serie.slice(0, h.getDate());
}

export type FatiaCategoria = { categoriaId: string | null; centavos: number };

/** Soma por categoria (contas fixas + gastos), da maior para a menor; zerados ficam de fora. */
export function porCategoria(itens: { valor: Valor; categoria_id: string | null }[]): FatiaCategoria[] {
  const soma = new Map<string | null, number>();
  for (const i of itens) soma.set(i.categoria_id, (soma.get(i.categoria_id) ?? 0) + paraCentavos(i.valor));
  return [...soma.entries()]
    .map(([categoriaId, centavos]) => ({ categoriaId, centavos }))
    .filter((f) => f.centavos > 0)
    .sort((a, b) => b.centavos - a.centavos);
}

/**
 * Junta as fatias menores que `limitePct`% do total em "Outras" (rótulos não se sobrepõem).
 * Uma única fatia pequena fica com o próprio nome — juntar uma só esconderia a categoria à toa.
 */
export function agruparPequenas(fatias: FatiaCategoria[], limitePct = 3): { fatias: FatiaCategoria[]; outras: FatiaCategoria[] } {
  const total = fatias.reduce((s, f) => s + f.centavos, 0);
  const pequena = (f: FatiaCategoria) => f.centavos * 100 < total * limitePct;
  const outras = fatias.filter(pequena);
  if (outras.length < 2) return { fatias, outras: [] };
  return { fatias: fatias.filter((f) => !pequena(f)), outras };
}

export type ContaAVencer ={ id: string; descricao: string; valor: Valor; vencimento: string; diasAte: number; atrasada: boolean };

/** Contas não pagas atrasadas ou que vencem nos próximos `janela` dias (mais urgentes primeiro). */
export function contasAVencer(
  contas: { id: string; descricao: string; valor: Valor; pago: boolean; vencimento: string | null }[],
  hoje: string,
  janela = 7,
): ContaAVencer[] {
  const h = parseData(hoje).getTime();
  const DIA = 86_400_000;
  return contas
    .filter((c) => !c.pago && c.vencimento)
    .map((c) => {
      // Diferença em dias de calendário (datas locais à meia-noite; arredonda o horário de verão)
      const diasAte = Math.round((parseData(c.vencimento!).getTime() - h) / DIA);
      return { id: c.id, descricao: c.descricao, valor: c.valor, vencimento: c.vencimento!, diasAte, atrasada: diasAte < 0 };
    })
    .filter((c) => c.diasAte <= janela)
    .sort((a, b) => a.diasAte - b.diasAte);
}

/** Limite (inclusivo) da janela de "a vencer": hoje + janela dias, em AAAA-MM-DD. */
export function limiteJanela(hoje: string, janela = 7): string {
  const d = parseData(hoje);
  return formatarData(new Date(d.getFullYear(), d.getMonth(), d.getDate() + janela));
}

export type TipoLancamento = "entrada" | "conta" | "gasto" | "investimento";
export type UltimoLancamento = { id: string; tipo: TipoLancamento; descricao: string; centavos: number; criadoEm: string };

/** Junta as listas e devolve os `n` lançamentos mais recentes (por created_at). */
export function ultimosLancamentos(
  listas: { tipo: TipoLancamento; itens: { id: string; descricao: string; valor: Valor; created_at: string }[] }[],
  n = 5,
): UltimoLancamento[] {
  return listas
    .flatMap(({ tipo, itens }) =>
      itens.map((i) => ({ id: i.id, tipo, descricao: i.descricao, centavos: paraCentavos(i.valor), criadoEm: i.created_at })),
    )
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : a.criadoEm > b.criadoEm ? -1 : 0))
    .slice(0, n);
}
