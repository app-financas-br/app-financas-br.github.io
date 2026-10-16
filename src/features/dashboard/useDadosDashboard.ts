import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { hoje as hojeLocal, mesAnterior, type Periodo } from "../../lib/datas";
import { paraCentavos } from "../../lib/dinheiro";
import { resumoMes, type ResumoMes } from "../../lib/calculos";
import { limiteJanela } from "../../lib/dashboard";
import { useLancamentos } from "../lancamentos/api";
import { usePreferencias } from "../preferencias/usePreferencias";
import type { ContaFixa, Entrada, Gasto, Investimento } from "../lancamentos/tipos";

/** Os 4 tipos de lançamento de um mês + o resumo calculado no front. */
function useMes(periodo: Periodo, soPago: boolean) {
  const entradas = useLancamentos<Entrada>("entradas", periodo);
  const contas = useLancamentos<ContaFixa>("contas_fixas", periodo);
  const gastos = useLancamentos<Gasto>("gastos_variaveis", periodo);
  const investimentos = useLancamentos<Investimento>("investimentos", periodo);
  const consultas = [entradas, contas, gastos, investimentos];

  const resumo = useMemo<ResumoMes | null>(
    () =>
      consultas.every((q) => q.data)
        ? resumoMes({
            entradas: entradas.data!,
            contasFixas: contas.data!,
            gastos: gastos.data!,
            investimentos: investimentos.data!,
            soPago,
          })
        : null,
    [entradas.data, contas.data, gastos.data, investimentos.data, soPago],
  );

  return {
    entradas: entradas.data ?? [],
    contas: contas.data ?? [],
    gastos: gastos.data ?? [],
    investimentos: investimentos.data ?? [],
    resumo,
    carregando: consultas.some((q) => q.isPending),
    erro: consultas.some((q) => q.isError),
    tentarDeNovo: () => consultas.forEach((q) => q.refetch()),
  };
}

/** Mesma conta do "Disponível", feita no banco (resumo_mes). Serve para conferir o front. */
function useResumoBanco({ ano, mes }: Periodo) {
  return useQuery({
    queryKey: ["resumo", ano, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_mes", { p_ano: ano, p_mes: mes });
      if (error) throw error;
      const r = (data as Record<string, number | string>[])[0];
      return r ? { disponivel: paraCentavos(r.disponivel), entradasRecebidas: paraCentavos(r.entradas_recebidas) } : null;
    },
  });
}

/** Contas não pagas com vencimento até hoje + 7 dias, de qualquer mês (inclui atrasadas). */
function useContasAVencer() {
  const hoje = hojeLocal();
  return useQuery({
    queryKey: ["contas_fixas", "a-vencer", hoje],
    queryFn: async (): Promise<ContaFixa[]> => {
      const { data, error } = await supabase
        .from("contas_fixas")
        .select("*")
        .eq("pago", false)
        .not("vencimento", "is", null)
        .lte("vencimento", limiteJanela(hoje))
        .order("vencimento");
      if (error) throw error;
      return data as ContaFixa[];
    },
  });
}

/** Os 5 lançamentos mais recentes de cada tabela (o Dashboard junta e corta em 5). */
function useRecentes<T>(tabela: "entradas" | "contas_fixas" | "gastos_variaveis" | "investimentos") {
  return useQuery({
    queryKey: [tabela, "recentes"],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(tabela)
        .select("id, descricao, valor, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as T[];
    },
  });
}

export function useDadosDashboard(periodo: Periodo) {
  const { prefs } = usePreferencias();
  const atual = useMes(periodo, prefs.so_pago);
  const anterior = useMes(mesAnterior(periodo), prefs.so_pago);
  const banco = useResumoBanco(periodo);
  const aVencer = useContasAVencer();
  type Recente = { id: string; descricao: string; valor: number | string; created_at: string };
  const recentes = {
    entrada: useRecentes<Recente>("entradas"),
    conta: useRecentes<Recente>("contas_fixas"),
    gasto: useRecentes<Recente>("gastos_variaveis"),
    investimento: useRecentes<Recente>("investimentos"),
  };

  // Critério de aceite: o "Disponível" do front precisa bater com resumo_mes do banco
  const bate = atual.resumo && banco.data ? atual.resumo.disponivel === banco.data.disponivel : null;
  useEffect(() => {
    if (bate === false) {
      console.warn("[dashboard] Disponível do front difere do banco", {
        front: atual.resumo?.disponivel,
        banco: banco.data?.disponivel,
      });
    }
  }, [bate, atual.resumo?.disponivel, banco.data?.disponivel]);

  return { prefs, atual, anterior, aVencer, recentes, conferidoComBanco: bate };
}
