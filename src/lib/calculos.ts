// Regras de cálculo do app (docs/01-produto.md). Tudo em centavos.
// A mesma regra do "Disponível" existe no banco em resumo_mes(ano, mes): os dois precisam bater.

import { formatarData, parseData, proximoMes, ultimoDiaDoMes, type Periodo } from "./datas";
import { paraCentavos } from "./dinheiro";

type Valor = number | string;
export type EntradaCalc = { valor: Valor; recebido: boolean };
export type SaidaCalc = { valor: Valor; pago: boolean };
export type InvestimentoCalc = { valor: Valor };

export type ResumoMes = {
  entradasRecebidas: number;
  entradasAReceber: number;
  contasFixas: number;
  gastosVariaveis: number;
  investido: number;
  disponivel: number;
};

const soma = (itens: { valor: Valor }[]) => itens.reduce((t, i) => t + paraCentavos(i.valor), 0);

/**
 * Disponível = entradas recebidas − contas fixas − gastos variáveis − investimentos do mês.
 * "A receber" não conta. Com soPago, fixas e gastos só descontam quando pagos.
 * Aporte (positivo) desconta; resgate (negativo) devolve.
 */
export function resumoMes(dados: {
  entradas: EntradaCalc[];
  contasFixas: SaidaCalc[];
  gastos: SaidaCalc[];
  investimentos: InvestimentoCalc[];
  soPago: boolean;
}): ResumoMes {
  const conta = (s: SaidaCalc) => s.pago || !dados.soPago;
  const entradasRecebidas = soma(dados.entradas.filter((e) => e.recebido));
  const entradasAReceber = soma(dados.entradas.filter((e) => !e.recebido));
  const contasFixas = soma(dados.contasFixas.filter(conta));
  const gastosVariaveis = soma(dados.gastos.filter(conta));
  const investido = soma(dados.investimentos);
  return {
    entradasRecebidas,
    entradasAReceber,
    contasFixas,
    gastosVariaveis,
    investido,
    disponivel: entradasRecebidas - contasFixas - gastosVariaveis - investido,
  };
}

export type RotuloSaude = "Tranquilo" | "Atenção" | "No limite";

/**
 * Saúde do mês (0–100) = (contas fixas + gastos) ÷ entradas recebidas × 100, limitado a 100.
 * Sem entradas recebidas: null (a tela mostra "—").
 */
export function saudeMes(r: Pick<ResumoMes, "entradasRecebidas" | "contasFixas" | "gastosVariaveis">): number | null {
  if (r.entradasRecebidas <= 0) return null;
  const pct = ((r.contasFixas + r.gastosVariaveis) / r.entradasRecebidas) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function rotuloSaude(pct: number): RotuloSaude {
  if (pct >= 90) return "No limite";
  if (pct >= 70) return "Atenção";
  return "Tranquilo";
}

/** Patrimônio = saldo inicial + soma de todos os investimentos (aportes − resgates), em centavos. */
export function patrimonio(saldoInicial: Valor, investimentos: InvestimentoCalc[]): number {
  return paraCentavos(saldoInicial) + soma(investimentos);
}

/** Variação % do atual sobre o anterior; null quando o anterior é zero. */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * Divide um total em N parcelas de centavos exatos:
 * cada uma recebe floor(total / N) e a última fica com a sobra.
 */
export function dividirParcelas(totalCentavos: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Número de parcelas inválido: ${n}`);
  if (!Number.isInteger(totalCentavos) || totalCentavos < 0) throw new Error(`Total inválido: ${totalCentavos}`);
  const base = Math.floor(totalCentavos / n);
  const parcelas = Array.from({ length: n }, () => base);
  parcelas[n - 1] = totalCentavos - base * (n - 1);
  return parcelas;
}

/** Períodos (ano/mês) das N parcelas a partir do período da 1ª, virando o ano quando preciso. */
export function periodosParcelas(inicio: Periodo, n: number): Periodo[] {
  const lista: Periodo[] = [inicio];
  for (let i = 1; i < n; i++) lista.push(proximoMes(lista[i - 1]!));
  return lista;
}

/**
 * Datas das N parcelas: mesmo dia nos meses seguintes, limitado ao último dia do mês
 * (31/01 → 28/02 ou 29/02 → 31/03).
 */
export function datasParcelas(dataInicial: string, n: number): string[] {
  const d = parseData(dataInicial);
  const dia = d.getDate();
  return periodosParcelas({ ano: d.getFullYear(), mes: d.getMonth() + 1 }, n).map(({ ano, mes }) =>
    formatarData(new Date(ano, mes - 1, Math.min(dia, ultimoDiaDoMes(ano, mes)))),
  );
}
