// Investimentos e patrimônio (docs/01-produto.md). Puro, em centavos.
// Aporte = valor positivo; resgate = valor negativo.

import { paraCentavos } from "./dinheiro";
import { patrimonio } from "./calculos";

type Valor = number | string;
export type InvestimentoMes = { ano: number; mes: number; valor: Valor; categoria_id: string | null };

/** Aportes, resgates (positivo) e líquido de uma lista. */
export function resumoInvestimentos(itens: { valor: Valor }[]): { aportes: number; resgates: number; liquido: number } {
  let aportes = 0;
  let resgates = 0;
  for (const i of itens) {
    const c = paraCentavos(i.valor);
    if (c > 0) aportes += c;
    else resgates -= c;
  }
  return { aportes, resgates, liquido: aportes - resgates };
}

export type PontoPatrimonio = { mes: number; patrimonio: number; liquido: number };

/**
 * Patrimônio ao fim de cada mês do ano (saldo inicial + tudo até aquele mês, inclusive anos
 * anteriores) e o líquido aportado em cada mês (as "barras de volume" do gráfico).
 */
export function patrimonioPorMes(saldoInicial: Valor, todos: InvestimentoMes[], ano: number): PontoPatrimonio[] {
  const antes = todos.filter((i) => i.ano < ano);
  let acumulado = patrimonio(saldoInicial, antes);
  return Array.from({ length: 12 }, (_, k) => {
    const mes = k + 1;
    const liquido = todos.filter((i) => i.ano === ano && i.mes === mes).reduce((s, i) => s + paraCentavos(i.valor), 0);
    acumulado += liquido;
    return { mes, patrimonio: acumulado, liquido };
  });
}

/** Quanto há em cada categoria (todos os anos); categorias zeradas ou negativas ficam de fora. */
export function saldoPorCategoria(todos: InvestimentoMes[]): { categoriaId: string | null; centavos: number }[] {
  const m = new Map<string | null, number>();
  for (const i of todos) m.set(i.categoria_id, (m.get(i.categoria_id) ?? 0) + paraCentavos(i.valor));
  return [...m.entries()]
    .map(([categoriaId, centavos]) => ({ categoriaId, centavos }))
    .filter((x) => x.centavos > 0)
    .sort((a, b) => b.centavos - a.centavos);
}

/**
 * Editar o total do patrimônio ajusta só o saldo inicial pela diferença (lançamentos não mudam).
 * Devolve o novo saldo inicial em centavos.
 */
export function saldoInicialParaPatrimonio(desejado: number, saldoInicial: Valor, todos: { valor: Valor }[]): number {
  return paraCentavos(saldoInicial) + (desejado - patrimonio(saldoInicial, todos));
}
