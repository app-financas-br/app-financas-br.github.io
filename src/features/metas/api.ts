import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/Toast";
import { t } from "../../i18n/pt-BR";

export type Meta = {
  id: string;
  nome: string;
  valor_alvo: number | string; // numeric do banco
  reservado: number | string;
  prazo: string | null;
  concluida: boolean;
  created_at: string;
};

const CAMPOS = "id, nome, valor_alvo, reservado, prazo, concluida, created_at";
const K = ["metas"] as const;

export function useMetas() {
  return useQuery({
    queryKey: K,
    queryFn: async (): Promise<Meta[]> => {
      const { data, error } = await supabase.from("metas").select(CAMPOS).order("created_at");
      if (error) throw error;
      return data as Meta[];
    },
  });
}

export function useCriarMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["salvar", "metas"],
    mutationFn: async (nova: Pick<Meta, "nome">): Promise<Meta> => {
      const { data, error } = await supabase.from("metas").insert(nova).select(CAMPOS).single();
      if (error) throw error;
      return data as Meta;
    },
    onSuccess: (nova) => qc.setQueryData<Meta[]>(K, (l = []) => [...l, nova]),
  });
}

/** Edição otimista; desfaz e avisa se o banco recusar. */
export function useAtualizarMeta() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationKey: ["salvar", "metas"],
    mutationFn: async ({ id, campos }: { id: string; campos: Partial<Omit<Meta, "id" | "created_at">> }) => {
      const { error } = await supabase.from("metas").update(campos).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, campos }) => {
      await qc.cancelQueries({ queryKey: K });
      const anterior = qc.getQueryData<Meta[]>(K);
      qc.setQueryData<Meta[]>(K, (l = []) => l.map((m) => (m.id === id ? { ...m, ...campos } : m)));
      return { anterior };
    },
    onError: (e, _v, ctx) => {
      console.error("[metas] salvar", e);
      if (ctx?.anterior) qc.setQueryData(K, ctx.anterior);
      mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
    },
  });
}

/** Excluir com "Desfazer" (5 s): some na hora e só apaga no banco depois. */
export function useExcluirMetaComDesfazer() {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return (meta: Meta) => {
    const lista = qc.getQueryData<Meta[]>(K) ?? [];
    const posicao = lista.findIndex((m) => m.id === meta.id);
    qc.setQueryData<Meta[]>(K, lista.filter((m) => m.id !== meta.id));
    const restaurar = () =>
      qc.setQueryData<Meta[]>(K, (atual = []) => {
        if (atual.some((m) => m.id === meta.id)) return atual;
        const copia = [...atual];
        copia.splice(posicao < 0 ? copia.length : Math.min(posicao, copia.length), 0, meta);
        return copia;
      });
    let desfeito = false;
    const timer = window.setTimeout(async () => {
      if (desfeito) return;
      const { error } = await supabase.from("metas").delete().eq("id", meta.id);
      if (error) {
        console.error("[metas] excluir", error);
        restaurar();
        mostrar({ tipo: "erro", texto: t.lanc.erroExcluir });
      }
    }, 5000);
    mostrar(
      {
        tipo: "info",
        texto: t.metas.excluida,
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
