import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Periodo } from "../../lib/datas";
import { useToast } from "../../components/ui/Toast";
import { t } from "../../i18n/pt-BR";

export type GrupoPlanejamento = {
  id: string;
  nome: string;
  cor: string;
  percentual_padrao: number | string; // numeric do banco
  ordem: number;
  chave: string | null;
};

export type PlanoMes = {
  id: string;
  ano: number;
  mes: number;
  renda_prevista: number | string;
  planejamento_percentuais: { grupo_id: string; percentual: number | string }[];
};

const CAMPOS_GRUPO = "id, nome, cor, percentual_padrao, ordem, chave";
const K_GRUPOS = ["planejamento_grupos"] as const;
const K_PLANOS = ["planejamentos"] as const;

/** Grupos do usuário (o RLS filtra por user_id), na ordem da tela. */
export function useGrupos() {
  return useQuery({
    queryKey: K_GRUPOS,
    queryFn: async (): Promise<GrupoPlanejamento[]> => {
      const { data, error } = await supabase.from("planejamento_grupos").select(CAMPOS_GRUPO).order("ordem").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/** Todos os planos salvos (poucos: no máximo um por mês) com as % de cada grupo. */
export function usePlanos() {
  return useQuery({
    queryKey: K_PLANOS,
    queryFn: async (): Promise<PlanoMes[]> => {
      const { data, error } = await supabase
        .from("planejamentos")
        .select("id, ano, mes, renda_prevista, planejamento_percentuais(grupo_id, percentual)")
        .order("ano")
        .order("mes");
      if (error) throw error;
      return data as PlanoMes[];
    },
  });
}

/** Grava o plano do mês inteiro (renda + todas as %) de uma vez, com edição otimista e rollback. */
export function useSalvarPlano() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationKey: ["salvar", "planejamentos"],
    mutationFn: async ({ periodo, renda, percentuais }: { periodo: Periodo; renda: number; percentuais: Record<string, number> }) => {
      const { error } = await supabase.rpc("salvar_planejamento", {
        p_ano: periodo.ano,
        p_mes: periodo.mes,
        p_renda: renda,
        p_percentuais: percentuais,
      });
      if (error) throw error;
    },
    onMutate: async ({ periodo, renda, percentuais }) => {
      await qc.cancelQueries({ queryKey: K_PLANOS });
      const anterior = qc.getQueryData<PlanoMes[]>(K_PLANOS);
      const novo: PlanoMes = {
        id: anterior?.find((p) => p.ano === periodo.ano && p.mes === periodo.mes)?.id ?? `novo-${periodo.ano}-${periodo.mes}`,
        ano: periodo.ano,
        mes: periodo.mes,
        renda_prevista: renda,
        planejamento_percentuais: Object.entries(percentuais).map(([grupo_id, percentual]) => ({ grupo_id, percentual })),
      };
      qc.setQueryData<PlanoMes[]>(K_PLANOS, (l = []) => [...l.filter((p) => p.id !== novo.id), novo]);
      return { anterior };
    },
    onError: (erro, _v, ctx) => {
      console.error("[planejamento] salvar", erro);
      if (ctx?.anterior) qc.setQueryData(K_PLANOS, ctx.anterior);
      mostrar({ tipo: "erro", texto: t.planejamento.erroSalvar });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: K_PLANOS }),
  });
}

/** Apaga os planos próprios dos meses depois do selecionado: eles passam a herdar este. */
export function useAplicarProximosMeses() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "planejamentos"],
    mutationFn: async ({ ano, mes }: Periodo) => {
      const { error } = await supabase
        .from("planejamentos")
        .delete()
        .or(`ano.gt.${ano},and(ano.eq.${ano},mes.gt.${mes})`);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: K_PLANOS }),
  });
}

export function useCriarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "planejamento_grupos"],
    mutationFn: async (novo: Pick<GrupoPlanejamento, "nome" | "cor" | "ordem">): Promise<GrupoPlanejamento> => {
      const { data, error } = await supabase.from("planejamento_grupos").insert(novo).select(CAMPOS_GRUPO).single();
      if (error) throw error;
      return data;
    },
    onSuccess: (novo) => qc.setQueryData<GrupoPlanejamento[]>(K_GRUPOS, (l = []) => [...l, novo]),
  });
}

/** Renomear/recolorir com edição otimista; desfaz se o banco recusar. */
export function useAtualizarGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "planejamento_grupos"],
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Pick<GrupoPlanejamento, "nome" | "cor">> }) => {
      const { error } = await supabase.from("planejamento_grupos").update(campos).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: K_GRUPOS });
      const anterior = qc.getQueryData<GrupoPlanejamento[]>(K_GRUPOS);
      qc.setQueryData<GrupoPlanejamento[]>(K_GRUPOS, (l = []) => l.map((g) => (g.id === id ? { ...g, ...campos } : g)));
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(K_GRUPOS, ctx.anterior);
    },
  });
}

/**
 * Excluir grupo com "Desfazer": some na hora e só apaga no banco depois de 5 s.
 * No banco, as categorias dele ficam sem grupo e as % dele somem dos planos.
 */
export function useExcluirGrupoComDesfazer() {
  const qc = useQueryClient();
  const { mostrar } = useToast();

  return (grupo: GrupoPlanejamento) => {
    const lista = qc.getQueryData<GrupoPlanejamento[]>(K_GRUPOS) ?? [];
    qc.setQueryData<GrupoPlanejamento[]>(K_GRUPOS, lista.filter((g) => g.id !== grupo.id));
    const restaurar = () =>
      qc.setQueryData<GrupoPlanejamento[]>(K_GRUPOS, (atual = []) =>
        atual.some((g) => g.id === grupo.id) ? atual : [...atual, grupo].sort((a, b) => a.ordem - b.ordem),
      );

    let desfeito = false;
    const timer = window.setTimeout(async () => {
      if (desfeito) return;
      const { error } = await supabase.from("planejamento_grupos").delete().eq("id", grupo.id);
      if (error) {
        console.error("[planejamento] excluir grupo", error);
        restaurar();
        mostrar({ tipo: "erro", texto: t.lanc.erroExcluir });
      } else {
        qc.invalidateQueries({ queryKey: K_PLANOS });
        qc.invalidateQueries({ queryKey: ["categorias"] });
      }
    }, 5000);

    mostrar(
      {
        tipo: "info",
        texto: t.planejamento.grupoExcluido,
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
