import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { InvestimentoMes } from "../../lib/investimentos";

/** Todos os investimentos (todos os anos), só o necessário para patrimônio e categorias. */
export function useTodosInvestimentos() {
  return useQuery({
    // começa com "investimentos": qualquer gravação de investimento já invalida esta consulta
    queryKey: ["investimentos", "todos"],
    queryFn: async (): Promise<InvestimentoMes[]> => {
      const { data, error } = await supabase.from("investimentos").select("ano, mes, valor, categoria_id");
      if (error) throw error;
      return data as InvestimentoMes[];
    },
  });
}
