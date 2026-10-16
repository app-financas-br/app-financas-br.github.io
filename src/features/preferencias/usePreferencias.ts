import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Moeda } from "../../lib/dinheiro";

export type Preferencias = {
  moeda: Moeda;
  idioma: string;
  tema: "dark" | "light";
  so_pago: boolean;
  saldo_inicial: number | string;
};

const PADRAO: Preferencias = { moeda: "BRL", idioma: "pt-BR", tema: "dark", so_pago: false, saldo_inicial: 0 };

/** Preferências do usuário logado (1 linha, criada no cadastro). */
export function usePreferencias() {
  const q = useQuery({
    queryKey: ["preferencias"],
    queryFn: async (): Promise<Preferencias> => {
      const { data, error } = await supabase
        .from("preferencias")
        .select("moeda, idioma, tema, so_pago, saldo_inicial")
        .maybeSingle();
      if (error) throw error;
      return data ?? PADRAO;
    },
  });
  return { ...q, prefs: q.data ?? PADRAO };
}

/** Grava o saldo inicial do patrimônio (edição otimista com rollback). */
export function useSalvarSaldoInicial() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "preferencias"],
    mutationFn: async (saldo_inicial: number) => {
      const { data: s } = await supabase.auth.getSession();
      const { error } = await supabase.from("preferencias").update({ saldo_inicial }).eq("user_id", s.session!.user.id);
      if (error) throw error;
    },
    onMutate: async (saldo_inicial) => {
      await qc.cancelQueries({ queryKey: ["preferencias"] });
      const anterior = qc.getQueryData<Preferencias>(["preferencias"]);
      qc.setQueryData<Preferencias>(["preferencias"], (p) => ({ ...(p ?? PADRAO), saldo_inicial }));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(["preferencias"], ctx.anterior);
    },
  });
}
