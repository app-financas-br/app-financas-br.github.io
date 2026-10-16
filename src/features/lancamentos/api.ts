import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Periodo } from "../../lib/datas";
import { useToast } from "../../components/ui/Toast";
import { t } from "../../i18n/pt-BR";
import type { TabelaMensal } from "./tipos";

type ComId = { id: string };

const chave = (tabela: TabelaMensal, { ano, mes }: Periodo) => [tabela, ano, mes] as const;

/** Depois de qualquer gravação: recalcula o que depende dos lançamentos (dashboard, resumo). */
function invalidarDerivados(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["resumo"] });
  qc.invalidateQueries({ queryKey: ["saldos_contas"] });
  qc.invalidateQueries({ queryKey: ["investimentos", "todos"] });
}

/** Lançamentos de uma tabela no mês/ano selecionado (sempre filtra ano E mes). */
export function useLancamentos<T extends ComId>(tabela: TabelaMensal, periodo: Periodo) {
  return useQuery({
    queryKey: chave(tabela, periodo),
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(tabela)
        .select("*")
        .eq("ano", periodo.ano)
        .eq("mes", periodo.mes)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as T[];
    },
  });
}

export function useCriarLancamento<T extends ComId>(tabela: TabelaMensal, periodo: Periodo) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationKey: ["salvar", tabela],
    mutationFn: async (valores: Partial<T>): Promise<T> => {
      const { data, error } = await supabase
        .from(tabela)
        .insert({ ...valores, ano: periodo.ano, mes: periodo.mes })
        .select("*")
        .single();
      if (error) throw error;
      return data as T;
    },
    onSuccess: (novo) => {
      qc.setQueryData<T[]>(chave(tabela, periodo), (lista = []) => [...lista, novo]);
      invalidarDerivados(qc);
    },
    onError: (erro) => {
      console.error("[lancamentos] criar", erro);
      mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
    },
  });
}

/** Edição otimista: atualiza a tela, grava no banco e desfaz (com aviso) se falhar. */
export function useAtualizarLancamento<T extends ComId>(tabela: TabelaMensal, periodo: Periodo) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const k = chave(tabela, periodo);
  return useMutation({
    mutationKey: ["salvar", tabela],
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<T> }) => {
      const { error } = await supabase.from(tabela).update(campos as Record<string, unknown>).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: k });
      const anterior = qc.getQueryData<T[]>(k);
      qc.setQueryData<T[]>(k, (lista = []) => lista.map((i) => (i.id === id ? { ...i, ...campos } : i)));
      return { anterior };
    },
    onError: (erro, _vars, ctx) => {
      console.error("[lancamentos] atualizar", erro);
      if (ctx?.anterior) qc.setQueryData(k, ctx.anterior);
      mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
    },
    onSuccess: () => invalidarDerivados(qc),
  });
}

/** Para excluir uma parcela e todas as seguintes do mesmo grupo (inclusive em outros meses). */
export type EscopoParcelas = { grupo: string; aPartirDe: number };

/**
 * Exclusão com "Desfazer": some da tela na hora e só apaga no banco depois de 5 s.
 * Se a pessoa desfizer, o item volta; se o banco recusar, o item volta com aviso.
 */
export function useExcluirComDesfazer<T extends ComId>(tabela: TabelaMensal, periodo: Periodo) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const k = chave(tabela, periodo);

  return (item: T, escopo?: EscopoParcelas) => {
    const lista = qc.getQueryData<T[]>(k) ?? [];
    const posicao = lista.findIndex((i) => i.id === item.id);
    qc.setQueryData<T[]>(k, lista.filter((i) => i.id !== item.id));

    const restaurar = () =>
      qc.setQueryData<T[]>(k, (atual = []) => {
        if (atual.some((i) => i.id === item.id)) return atual;
        const copia = [...atual];
        copia.splice(posicao < 0 ? copia.length : Math.min(posicao, copia.length), 0, item);
        return copia;
      });

    let desfeito = false;
    const timer = window.setTimeout(async () => {
      if (desfeito) return;
      const { error } = escopo
        ? await supabase.from(tabela).delete().eq("grupo_parcela", escopo.grupo).gte("parcela_num", escopo.aPartirDe)
        : await supabase.from(tabela).delete().eq("id", item.id);
      if (error) {
        console.error("[lancamentos] excluir", error);
        restaurar();
        mostrar({ tipo: "erro", texto: t.lanc.erroExcluir });
      } else {
        // As próximas parcelas estão em outros meses: recarrega todos os meses da tabela
        if (escopo) qc.invalidateQueries({ queryKey: [tabela] });
        invalidarDerivados(qc);
      }
    }, 5000);

    mostrar(
      {
        tipo: "info",
        texto: escopo ? t.parcelas.excluidas : t.lanc.excluido,
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
