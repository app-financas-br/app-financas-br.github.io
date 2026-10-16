// Cartão de crédito (docs/08-cartao.md): o gasto conta no mês em que a fatura VENCE.
// Funções puras, datas AAAA-MM-DD no fuso local (sem new Date('AAAA-MM-DD')).

import { formatarData, parseData, ultimoDiaDoMes, type Periodo } from "./datas";

export type RegraCartao = {
  diaFechamento: number; // 1–31
  diaVencimento: number; // 1–31
  /** Compra feita NO dia do fechamento já vai para a fatura seguinte (padrão do banco: ligado). */
  compraNoFechamentoProxima: boolean;
};

export type Fatura = Periodo & { fechamento: string; vencimento: string };

/** Dia limitado ao último dia do mês (fechamento 31 em fevereiro = 28/29). */
const dataLimitada = (ano: number, mes: number, dia: number) => formatarData(new Date(ano, mes - 1, Math.min(dia, ultimoDiaDoMes(ano, mes))));
const somarMes = (ano: number, mes: number, n: number): Periodo => {
  const total = ano * 12 + (mes - 1) + n;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
};

/** Fatura que fecha no mês (ano, mes): fechamento e vencimento. */
export function faturaQueFechaEm(ano: number, mes: number, r: RegraCartao): Fatura {
  // Vence no mesmo mês do fechamento só se o dia de vencimento vier depois do de fechamento
  const v = r.diaVencimento > r.diaFechamento ? { ano, mes } : somarMes(ano, mes, 1);
  return { ano: v.ano, mes: v.mes, fechamento: dataLimitada(ano, mes, r.diaFechamento), vencimento: dataLimitada(v.ano, v.mes, r.diaVencimento) };
}

/**
 * Fatura de uma compra. Antes do fechamento do mês da compra → fatura que fecha nesse mês;
 * depois → a do mês seguinte. NO dia do fechamento depende de `compraNoFechamentoProxima`.
 */
export function faturaDaCompra(dataCompra: string, r: RegraCartao): Fatura {
  const d = parseData(dataCompra);
  const ano = d.getFullYear();
  const mes = d.getMonth() + 1;
  const fechamento = Math.min(r.diaFechamento, ultimoDiaDoMes(ano, mes));
  const dia = d.getDate();
  const vaiParaProxima = r.compraNoFechamentoProxima ? dia >= fechamento : dia > fechamento;
  const f = vaiParaProxima ? somarMes(ano, mes, 1) : { ano, mes };
  return faturaQueFechaEm(f.ano, f.mes, r);
}

/** Fatura atual (a de uma compra feita hoje) e a seguinte. */
export function faturasDoCartao(hoje: string, r: RegraCartao): { atual: Fatura; proxima: Fatura } {
  const atual = faturaDaCompra(hoje, r);
  const fechou = parseData(atual.fechamento);
  const seguinte = somarMes(fechou.getFullYear(), fechou.getMonth() + 1, 1);
  return { atual, proxima: faturaQueFechaEm(seguinte.ano, seguinte.mes, r) };
}

/** "Loja - Parcela 2/6", "PARC 02/06", "parcela 2 de 6" → { num: 2, total: 6 }. */
export function parcelaDaDescricao(descricao: string): { num: number; total: number } | null {
  const m = /\bparc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b/i.exec(descricao);
  if (!m) return null;
  const num = Number(m[1]);
  const total = Number(m[2]);
  return num >= 1 && total >= 2 && num <= total && total <= 48 ? { num, total } : null;
}

/** Cartão com fechamento e vencimento informados → regra; senão null (usa o mês da compra). */
export function regraDoCartao(c: { dia_fechamento: number | null; dia_vencimento: number | null; compra_no_fechamento_proxima: boolean }): RegraCartao | null {
  if (!c.dia_fechamento || !c.dia_vencimento) return null;
  return { diaFechamento: c.dia_fechamento, diaVencimento: c.dia_vencimento, compraNoFechamentoProxima: c.compra_no_fechamento_proxima };
}

// ---------------------------------------------------------------------------
// Escolha do mês da fatura no lançamento manual (docs/08-cartao.md).
// "Paga este mês" = mês da compra; "Paga mês que vem" = o seguinte; qualquer outro mês = "outro".

export type OpcaoFatura = "este" | "proximo" | "outro";

/** Período somado de n meses (n pode ser negativo). */
export const somarMeses = (p: Periodo, n: number): Periodo => somarMes(p.ano, p.mes, n);
const indice = (p: Periodo) => p.ano * 12 + (p.mes - 1);

/** Mês (ano/mês) de uma data AAAA-MM-DD. */
export function mesDaData(data: string): Periodo {
  const d = parseData(data);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}

/** Mês da fatura de cada botão de escolha rápida. */
export function faturaDaOpcao(dataCompra: string, opcao: "este" | "proximo"): Periodo {
  return somarMeses(mesDaData(dataCompra), opcao === "este" ? 0 : 1);
}

/** Qual botão fica marcado para o mês escolhido em "Fatura de". */
export function opcaoDaFatura(dataCompra: string, fatura: Periodo): OpcaoFatura {
  const dif = indice(fatura) - indice(mesDaData(dataCompra));
  return dif === 0 ? "este" : dif === 1 ? "proximo" : "outro";
}

/**
 * Sugestão que vem marcada: com fechamento/vencimento cadastrados, a regra do cartão;
 * sem cadastro, "Paga este mês" (nunca adivinha o mês seguinte).
 */
export function sugerirFatura(dataCompra: string, regra: RegraCartao | null): Periodo {
  if (!regra) return mesDaData(dataCompra);
  const f = faturaDaCompra(dataCompra, regra);
  return { ano: f.ano, mes: f.mes };
}

/**
 * Mês da fatura quando a data da compra muda na tabela: se a pessoa estava na sugestão,
 * segue a nova sugestão; se tinha trocado à mão, mantém a mesma distância do mês da compra.
 */
export function faturaAoMudarData(dataAntiga: string | null, faturaAtual: Periodo, dataNova: string, regra: RegraCartao | null): Periodo {
  if (!dataAntiga) return sugerirFatura(dataNova, regra);
  const sugerida = sugerirFatura(dataAntiga, regra);
  if (indice(sugerida) === indice(faturaAtual)) return sugerirFatura(dataNova, regra);
  return somarMeses(mesDaData(dataNova), indice(faturaAtual) - indice(mesDaData(dataAntiga)));
}

/** Parcelado: a 1ª parcela no mês escolhido e as demais nos meses seguintes. */
export function faturasDasParcelas(primeira: Periodo, n: number): Periodo[] {
  return Array.from({ length: n }, (_, i) => somarMeses(primeira, i));
}
