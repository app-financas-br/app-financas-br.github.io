// Exportação para Excel (docs/05-roadmap.md, Fase 3): monta as abas a partir dos lançamentos.
// Função pura: o arquivo .xlsx é gravado em features/exportacao/excel.ts (exceljs sob demanda).
// Agrupa sempre por ano + mês (nunca mistura anos) e guarda valores em centavos.

import { resumoMes } from "./calculos";
import { paraCentavos } from "./dinheiro";
import type { Periodo } from "./datas";
import type { ContaFixa, Entrada, Gasto, Investimento } from "../features/lancamentos/tipos";
import { t } from "../i18n/pt-BR";

export type TipoColuna = "texto" | "inteiro" | "data" | "moeda";
export type Coluna = { titulo: string; tipo: TipoColuna; largura: number };
/** data = "AAAA-MM-DD"; moeda = centavos; inteiro = número; texto = string. Vazio = null. */
export type ValorCelula = string | number | null;
export type Aba = { nome: string; colunas: Coluna[]; linhas: ValorCelula[][] };

export type DadosExportacao = {
  entradas: Entrada[];
  contasFixas: ContaFixa[];
  gastos: Gasto[];
  investimentos: Investimento[];
  categorias: { id: string; nome: string }[];
  contasBancarias: { id: string; nome: string }[];
};

const e = t.exportacao.colunas;
const col = (titulo: string, tipo: TipoColuna, largura = 14): Coluna => ({ titulo, tipo, largura });
const ANO = col(e.ano, "inteiro", 7);
const MES = col(e.mes, "inteiro", 6);

/** Ordem de leitura: ano, mês, data e descrição. */
function ordenar<T extends { ano: number; mes: number; descricao: string }>(itens: T[], data: (i: T) => string | null): T[] {
  return [...itens].sort(
    (a, b) => a.ano - b.ano || a.mes - b.mes || (data(a) ?? "").localeCompare(data(b) ?? "") || a.descricao.localeCompare(b.descricao, "pt-BR"),
  );
}

const parcela = (i: { parcela_num: number | null; parcela_total: number | null }) =>
  i.parcela_num && i.parcela_total ? `${i.parcela_num}/${i.parcela_total}` : null;

/** Abas do Excel: Resumo (um mês por linha) + uma aba por tabela, uma linha por lançamento. */
export function montarAbas(dados: DadosExportacao, periodos: Periodo[], soPago: boolean): Aba[] {
  // Só os meses pedidos: um lançamento de outro ano nunca entra no arquivo
  const pedidos = new Set(periodos.map((p) => p.ano * 100 + p.mes));
  const noPeriodo = <T extends { ano: number; mes: number }>(itens: T[]) => itens.filter((i) => pedidos.has(i.ano * 100 + i.mes));
  const d = {
    ...dados,
    entradas: noPeriodo(dados.entradas),
    contasFixas: noPeriodo(dados.contasFixas),
    gastos: noPeriodo(dados.gastos),
    investimentos: noPeriodo(dados.investimentos),
  };
  const nomeCat = new Map(d.categorias.map((c) => [c.id, c.nome]));
  const nomeConta = new Map(d.contasBancarias.map((c) => [c.id, c.nome]));
  const cat = (id: string | null | undefined) => (id ? nomeCat.get(id) ?? null : null);
  const conta = (id: string | null | undefined) => (id ? nomeConta.get(id) ?? null : null);
  const doMes = <T extends { ano: number; mes: number }>(itens: T[], p: Periodo) => itens.filter((i) => i.ano === p.ano && i.mes === p.mes);

  const resumo: Aba = {
    nome: t.exportacao.abas.resumo,
    colunas: [ANO, MES, col(e.entradasRecebidas, "moeda", 18), col(e.aReceber, "moeda"), col(e.contasFixas, "moeda"), col(e.gastos, "moeda", 16), col(e.investido, "moeda"), col(e.disponivel, "moeda")],
    linhas: periodos.map((p) => {
      const r = resumoMes({
        entradas: doMes(d.entradas, p),
        contasFixas: doMes(d.contasFixas, p),
        gastos: doMes(d.gastos, p),
        investimentos: doMes(d.investimentos, p),
        soPago,
      });
      return [p.ano, p.mes, r.entradasRecebidas, r.entradasAReceber, r.contasFixas, r.gastosVariaveis, r.investido, r.disponivel];
    }),
  };

  const entradas: Aba = {
    nome: t.exportacao.abas.entradas,
    colunas: [ANO, MES, col(e.data, "data", 12), col(e.descricao, "texto", 30), col(e.valor, "moeda"), col(e.status, "texto", 12), col(e.conta, "texto", 18)],
    linhas: ordenar(d.entradas, (i) => i.data).map((i) => [
      i.ano, i.mes, i.data, i.descricao, paraCentavos(i.valor), i.recebido ? t.lanc.recebido : t.lanc.aReceber, conta(i.conta_bancaria_id),
    ]),
  };

  const contasFixas: Aba = {
    nome: t.exportacao.abas.contasFixas,
    colunas: [ANO, MES, col(e.vencimento, "data", 12), col(e.descricao, "texto", 30), col(e.categoria, "texto", 18), col(e.valor, "moeda"), col(e.status, "texto", 10), col(e.parcela, "texto", 8)],
    linhas: ordenar(d.contasFixas, (i) => i.vencimento).map((i) => [
      i.ano, i.mes, i.vencimento, i.descricao, cat(i.categoria_id), paraCentavos(i.valor), i.pago ? t.lanc.pago : t.lanc.pendente, parcela(i),
    ]),
  };

  const gastos: Aba = {
    nome: t.exportacao.abas.gastos,
    colunas: [
      ANO, MES, col(e.data, "data", 12), col(e.descricao, "texto", 30), col(e.categoria, "texto", 18), col(e.valor, "moeda"),
      col(e.pagamento, "texto", 10), col(e.cartaoConta, "texto", 18), col(e.status, "texto", 10), col(e.parcela, "texto", 8), col(e.observacao, "texto", 30),
    ],
    linhas: ordenar(d.gastos, (i) => i.data).map((i) => [
      i.ano, i.mes, i.data, i.descricao, cat(i.categoria_id), paraCentavos(i.valor),
      t.lanc.formas[i.forma_pagamento], conta(i.conta_bancaria_id) ?? i.cartao, i.pago ? t.lanc.pago : t.lanc.pendente, parcela(i), i.observacao,
    ]),
  };

  const investimentos: Aba = {
    nome: t.exportacao.abas.investimentos,
    colunas: [ANO, MES, col(e.data, "data", 12), col(e.descricao, "texto", 30), col(e.categoria, "texto", 18), col(e.tipo, "texto", 10), col(e.valor, "moeda")],
    linhas: ordenar(d.investimentos, (i) => i.data).map((i) => {
      const c = paraCentavos(i.valor);
      // Resgate fica negativo no banco; na planilha, o tipo diz o sentido e o valor também mantém o sinal
      return [i.ano, i.mes, i.data, i.descricao, cat(i.categoria_id), c < 0 ? t.investimentos.resgate : t.investimentos.aporte, c];
    }),
  };

  return [resumo, entradas, contasFixas, gastos, investimentos];
}

/** "financas-2026-10.xlsx" (mês) ou "financas-2026.xlsx" (ano). */
export function nomeArquivo(ano: number, mes?: number): string {
  return mes ? `financas-${ano}-${String(mes).padStart(2, "0")}.xlsx` : `financas-${ano}.xlsx`;
}

/** Meses da exportação: um mês, ou os 12 do ano. */
export function periodosDaExportacao(ano: number, mes?: number): Periodo[] {
  return mes ? [{ ano, mes }] : Array.from({ length: 12 }, (_, i) => ({ ano, mes: i + 1 }));
}
