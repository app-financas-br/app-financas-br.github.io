import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type Categoria = {
  id: string;
  tipo: "gasto" | "investimento";
  nome: string;
  cor: string;
  icone: string;
  ordem: number;
};

/** Categorias visíveis do usuário logado (o RLS já filtra por user_id). */
export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, tipo, nome, cor, icone, ordem")
        .eq("oculta", false)
        .order("tipo")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });
}
