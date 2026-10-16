import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { paraCentavos } from "../../lib/dinheiro";
import { useToast } from "../../components/ui/Toast";
import { t } from "../../i18n/pt-BR";

export type TipoConta = "corrente" | "poupanca" | "cartao_credito";
export const TIPOS_CONTA: TipoConta[] = ["corrente", "poupanca", "cartao_credito"];

export type ContaBancaria = {
  id: string;
  nome: string;
  banco: string;
  tipo: TipoConta;
  saldo_inicial: number | string; // numeric do banco
  cor: string;
  ativa: boolean;
  ofx_banco: string | null;
  ofx_conta: string | null;
  // Só cartão de crédito (docs/08-cartao.md)
  dia_fechamento: number | null;
  dia_vencimento: number | null;
  conta_pagamento_id: string | null;
  compra_no_fechamento_proxima: boolean;
};

const CAMPOS =
  "id, nome, banco, tipo, saldo_inicial, cor, ativa, ofx_banco, ofx_conta, dia_fechamento, dia_vencimento, conta_pagamento_id, compra_no_fechamento_proxima";
const K = ["contas_bancarias"] as const;
export const K_SALDOS = ["saldos_contas"] as const;

export function useContasBancarias() {
  return useQuery({
    queryKey: K,
    queryFn: async (): Promise<ContaBancaria[]> => {
      const { data, error } = await supabase.from("contas_bancarias").select(CAMPOS).order("created_at");
      if (error) throw error;
      return data as ContaBancaria[];
    },
  });
}

/** Saldo de cada conta em centavos, calculado no banco (saldos_contas). */
export function useSaldosContas() {
  return useQuery({
    queryKey: K_SALDOS,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.rpc("saldos_contas");
      if (error) throw error;
      return new Map((data as { conta_id: string; saldo: number | string }[]).map((r) => [r.conta_id, paraCentavos(r.saldo)]));
    },
  });
}

export type NovaConta = Pick<ContaBancaria, "nome" | "banco" | "tipo" | "cor"> & Partial<Pick<ContaBancaria, "ofx_banco" | "ofx_conta" | "saldo_inicial">>;

export function useCriarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "contas_bancarias"],
    mutationFn: async (nova: NovaConta): Promise<ContaBancaria> => {
      const { data, error } = await supabase.from("contas_bancarias").insert(nova).select(CAMPOS).single();
      if (error) throw error;
      return data as ContaBancaria;
    },
    onSuccess: (nova) => {
      qc.setQueryData<ContaBancaria[]>(K, (l = []) => [...l, nova]);
      qc.invalidateQueries({ queryKey: K_SALDOS });
    },
  });
}

type CamposEditaveis = Partial<
  Pick<
    ContaBancaria,
    "nome" | "banco" | "tipo" | "saldo_inicial" | "cor" | "ativa" | "ofx_banco" | "ofx_conta"
    | "dia_fechamento" | "dia_vencimento" | "conta_pagamento_id" | "compra_no_fechamento_proxima"
  >
>;

/** Edição otimista; desfaz se o banco recusar. */
export function useAtualizarConta() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "contas_bancarias"],
    mutationFn: async ({ id, campos }: { id: string; campos: CamposEditaveis }) => {
      const { error } = await supabase.from("contas_bancarias").update(campos).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: K });
      const anterior = qc.getQueryData<ContaBancaria[]>(K);
      qc.setQueryData<ContaBancaria[]>(K, (l = []) => l.map((c) => (c.id === id ? { ...c, ...campos } : c)));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(K, ctx.anterior);
    },
    onSettled: (_d, _e, { campos }) => {
      if ("saldo_inicial" in campos) qc.invalidateQueries({ queryKey: K_SALDOS });
    },
  });
}

/**
 * Excluir com "Desfazer" (5 s). Conta com transferências não pode ser apagada (FK):
 * a conta volta e o aviso sugere desativar.
 */
export function useExcluirContaComDesfazer() {
  const qc = useQueryClient();
  const { mostrar } = useToast();

  return (conta: ContaBancaria) => {
    const lista = qc.getQueryData<ContaBancaria[]>(K) ?? [];
    const posicao = lista.findIndex((c) => c.id === conta.id);
    qc.setQueryData<ContaBancaria[]>(K, lista.filter((c) => c.id !== conta.id));
    const restaurar = () =>
      qc.setQueryData<ContaBancaria[]>(K, (atual = []) => {
        if (atual.some((c) => c.id === conta.id)) return atual;
        const copia = [...atual];
        copia.splice(posicao < 0 ? copia.length : Math.min(posicao, copia.length), 0, conta);
        return copia;
      });

    let desfeito = false;
    const timer = window.setTimeout(async () => {
      if (desfeito) return;
      const { error } = await supabase.from("contas_bancarias").delete().eq("id", conta.id);
      if (error) {
        console.error("[contas] excluir", error);
        restaurar();
        mostrar({ tipo: "erro", texto: error.code === "23503" ? t.contas.temTransferencias : t.lanc.erroExcluir });
      } else {
        qc.invalidateQueries({ queryKey: K_SALDOS });
      }
    }, 5000);

    mostrar(
      {
        tipo: "info",
        texto: t.contas.excluida,
        acao: {
          rotulo: t.lanc.desfazer,
          onClick: () => {
            desfeito = true;
            window.clearTimeout(timer);
            restaurar();
          },
        },
      },
      5000,
    );
  };
}

/** Totais da fatura atual e da próxima de cada cartão (gastos do cartão no mês de cada fatura). */
export function useFaturasCartoes(cartoes: { id: string; periodos: { ano: number; mes: number }[] }[]) {
  const ids = cartoes.map((c) => c.id);
  const periodos = [...new Map(cartoes.flatMap((c) => c.periodos).map((p) => [`${p.ano}-${p.mes}`, p])).values()];
  return useQuery({
    queryKey: ["gastos_variaveis", "faturas", ids, periodos],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from("gastos_variaveis")
        .select("valor, ano, mes, conta_bancaria_id")
        .in("conta_bancaria_id", ids)
        .or(periodos.map((p) => `and(ano.eq.${p.ano},mes.eq.${p.mes})`).join(","));
      if (error) throw error;
      // chave "conta|ano|mes" → centavos
      const m = new Map<string, number>();
      for (const g of data as { valor: number | string; ano: number; mes: number; conta_bancaria_id: string }[]) {
        const k = `${g.conta_bancaria_id}|${g.ano}|${g.mes}`;
        m.set(k, (m.get(k) ?? 0) + paraCentavos(g.valor));
      }
      return m;
    },
  });
}
