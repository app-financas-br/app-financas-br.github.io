import { useCallback, useMemo } from "react";
import { categorizar } from "../../lib/categorizar";
import { useCategorias, useRegrasCategoria, useSalvarRegra } from "../categorias/useCategorias";

/** Categorias de gasto/conta fixa + auto-categorização + gravação de regra na troca manual. */
export function useCategoriasGasto() {
  const { data: todas = [] } = useCategorias();
  const { data: regras = [] } = useRegrasCategoria();
  const salvarRegra = useSalvarRegra();

  const categorias = useMemo(() => todas.filter((c) => c.tipo === "gasto"), [todas]);

  /** Categoria automática para uma descrição: regra manual → palavras-chave → Outros. */
  const auto = useCallback((descricao: string) => categorizar(descricao, { categorias, regras }), [categorias, regras]);

  return { categorias, auto, salvarRegra: salvarRegra.mutate };
}
