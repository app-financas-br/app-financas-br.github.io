export type Tabela = "entradas" | "contas_fixas" | "gastos_variaveis";
/** Tabelas que o app lê por mês (investimentos ganha tela própria na Fase 2). */
export type TabelaMensal = Tabela | "investimentos";
export type FormaPagamento = "pix" | "debito" | "credito" | "dinheiro";

type Base = {
  id: string;
  ano: number;
  mes: number;
  descricao: string;
  valor: number | string; // numeric do banco: sempre passar por Number()/paraCentavos
  origem: string;
  created_at: string;
};

type Parcela = {
  grupo_parcela: string | null;
  parcela_num: number | null;
  parcela_total: number | null;
};

export type Entrada = Base & { recebido: boolean; data: string | null };

export type ContaFixa = Base &
  Parcela & { pago: boolean; vencimento: string | null; categoria_id: string | null };

export type Gasto = Base &
  Parcela & {
    pago: boolean;
    forma_pagamento: FormaPagamento;
    cartao: string | null;
    /** Conta bancária do gasto; no crédito, o cartão (docs/08-cartao.md). */
    conta_bancaria_id?: string | null;
    data: string | null;
    categoria_id: string | null;
    observacao: string | null;
  };

export type Investimento = Base & { data: string | null; categoria_id: string | null; destino: string | null };

export type Lancamento = Entrada | ContaFixa | Gasto;

export const FORMAS: FormaPagamento[] = ["pix", "debito", "credito", "dinheiro"];
