import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { normalizar, type RegraCategoria } from "../../lib/categorizar";

export type Categoria = {
  id: string;
  tipo: "gasto" | "investimento";
  nome: string;
  cor: string;
  icone: string;
  palavras: string[];
  padrao: boolean;
  oculta: boolean;
  ordem: number;
  /** Grupo do planejamento (null = sem grupo). */
  grupo_id: string | null;
};

/** "Outros" padrão de gasto: destino da auto-categorização quando nada casa (não pode ser ocultada nem renomeada). */
export const ehCategoriaReserva = (c: Pick<Categoria, "tipo" | "padrao" | "ordem">) =>
  c.tipo === "gasto" && c.padrao && c.ordem === 99;

/** Todas as categorias do usuário logado (o RLS já filtra por user_id), inclusive ocultas. */
export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, tipo, nome, cor, icone, palavras, padrao, oculta, ordem, grupo_id")
        .order("tipo")
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });
}

/** Regras manuais: "sempre que o lançamento se chamar X, a categoria é Y". */
export function useRegrasCategoria() {
  return useQuery({
    queryKey: ["categoria_regras"],
    queryFn: async (): Promise<RegraCategoria[]> => {
      const { data, error } = await supabase.from("categoria_regras").select("termo, categoria_id");
      if (error) throw error;
      return data;
    },
  });
}

/** Edição otimista de uma categoria (nome, cor, oculta, ordem); desfaz se o banco recusar. */
export function useAtualizarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "categorias"],
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Pick<Categoria, "nome" | "cor" | "oculta" | "ordem" | "grupo_id">> }) => {
      const { error } = await supabase.from("categorias").update(campos).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: ["categorias"] });
      const anterior = qc.getQueryData<Categoria[]>(["categorias"]);
      qc.setQueryData<Categoria[]>(["categorias"], (l = []) => l.map((c) => (c.id === id ? { ...c, ...campos } : c)));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(["categorias"], ctx.anterior);
    },
  });
}

export function useCriarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "categorias"],
    mutationFn: async (nova: Pick<Categoria, "tipo" | "nome" | "cor" | "ordem">): Promise<Categoria> => {
      const { data, error } = await supabase
        .from("categorias")
        .insert(nova)
        .select("id, tipo, nome, cor, icone, palavras, padrao, oculta, ordem, grupo_id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (nova) => qc.setQueryData<Categoria[]>(["categorias"], (l = []) => [...l, nova]),
  });
}

/** Grava (ou troca) a regra para o nome do lançamento quando a pessoa escolhe a categoria à mão. */
export function useSalvarRegra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ descricao, categoriaId }: { descricao: string; categoriaId: string }) => {
      const termo = normalizar(descricao);
      if (!termo) return;
      const { error } = await supabase
        .from("categoria_regras")
        .upsert({ termo, categoria_id: categoriaId }, { onConflict: "user_id,termo" });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["categoria_regras"] }),
  });
}
