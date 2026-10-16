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
