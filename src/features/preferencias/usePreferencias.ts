import { useQuery } from "@tanstack/react-query";
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
