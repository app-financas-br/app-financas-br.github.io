import { useMemo } from "react";
import type { Periodo } from "../../lib/datas";
import { deCentavos, paraCentavos } from "../../lib/dinheiro";
import { deBp, paraBp, planosFuturos, planoVigente, previstoPorGrupo, realizadoPorGrupo } from "../../lib/planejamento";
import { useLancamentos } from "../lancamentos/api";
import { useCategorias } from "../categorias/useCategorias";
import { usePreferencias } from "../preferencias/usePreferencias";
import type { ContaFixa, Entrada, Gasto, Investimento } from "../lancamentos/tipos";
import { useGrupos, usePlanos, useSalvarPlano, type GrupoPlanejamento } from "./api";

export type OrigemPlano = { tipo: "proprio" } | { tipo: "herdado"; de: Periodo } | { tipo: "padrao" };

export type LinhaPlano = { grupo: GrupoPlanejamento; bp: number; previsto: number; realizado: number };

/**
 * Plano em vigor no mês + previsto × realizado por grupo (docs/06-planejamento.md).
 * Mês sem plano usa o último salvo antes dele; sem plano nenhum, a renda vem das entradas
 * do mês e as % do padrão de cada grupo.
 */
export function usePlanejamentoMes(periodo: Periodo) {
  const grupos = useGrupos();
  const planos = usePlanos();
  const categorias = useCategorias();
  const { prefs } = usePreferencias();
  const entradas = useLancamentos<Entrada>("entradas", periodo);
  const contas = useLancamentos<ContaFixa>("contas_fixas", periodo);
  const gastos = useLancamentos<Gasto>("gastos_variaveis", periodo);
  const investimentos = useLancamentos<Investimento>("investimentos", periodo);
  const consultas = [grupos, planos, categorias, entradas, contas, gastos, investimentos];
  const salvarPlano = useSalvarPlano();

  const calculo = useMemo(() => {
    if (!consultas.every((q) => q.data)) return null;
    const listaGrupos = [...grupos.data!].sort((a, b) => a.ordem - b.ordem);
    const vigente = planoVigente(planos.data!, periodo);

    const origem: OrigemPlano = !vigente
      ? { tipo: "padrao" }
      : vigente.ano === periodo.ano && vigente.mes === periodo.mes
        ? { tipo: "proprio" }
        : { tipo: "herdado", de: { ano: vigente.ano, mes: vigente.mes } };

    const renda = vigente
      ? paraCentavos(vigente.renda_prevista)
      : entradas.data!.reduce((s, e) => s + paraCentavos(e.valor), 0);

    const doPlano = new Map(vigente?.planejamento_percentuais.map((p) => [p.grupo_id, paraBp(p.percentual)]) ?? []);
    const bp = new Map(listaGrupos.map((g) => [g.id, vigente ? doPlano.get(g.id) ?? 0 : paraBp(g.percentual_padrao)]));

    const previstos = previstoPorGrupo(renda, listaGrupos.map((g) => ({ id: g.id, bp: bp.get(g.id)! })));
    const realizados = realizadoPorGrupo({
      categorias: categorias.data!,
      contas: contas.data!,
      gastos: gastos.data!,
      investimentos: investimentos.data!,
      soPago: prefs.so_pago,
    });

    const linhas: LinhaPlano[] = listaGrupos.map((g) => ({
      grupo: g,
      bp: bp.get(g.id)!,
      previsto: previstos.get(g.id) ?? 0,
      realizado: realizados.get(g.id) ?? 0,
    }));
    // Categorias ligadas a um grupo que acabou de ser excluído também contam como "sem grupo"
    const ids = new Set(listaGrupos.map((g) => g.id));
    const semGrupo = [...realizados.entries()].filter(([g]) => g === null || !ids.has(g)).reduce((s, [, v]) => s + v, 0);
    const totalBp = linhas.reduce((s, l) => s + l.bp, 0);
    const totalPrevisto = linhas.reduce((s, l) => s + l.previsto, 0);

    return {
      origem,
      renda,
      linhas,
      semGrupo,
      totalBp,
      sobra: renda - totalPrevisto,
      futuros: planosFuturos(planos.data!, periodo).length,
    };
  }, [grupos.data, planos.data, categorias.data, entradas.data, contas.data, gastos.data, investimentos.data, prefs.so_pago, periodo.ano, periodo.mes]);

  /** Salva o plano do mês com a mudança (num mês herdado, cria o plano próprio a partir do herdado). */
  const salvar = (mudanca: { renda?: number } | { grupoId: string; bp: number }) => {
    if (!calculo) return;
    const percentuais = Object.fromEntries(calculo.linhas.map((l) => [l.grupo.id, deBp(l.bp)]));
    if ("grupoId" in mudanca) percentuais[mudanca.grupoId] = deBp(mudanca.bp);
    const renda = "renda" in mudanca && mudanca.renda !== undefined ? mudanca.renda : calculo.renda;
    salvarPlano.mutate({ periodo, renda: deCentavos(renda), percentuais });
  };

  return {
    calculo,
    salvar,
    carregando: consultas.some((q) => q.isPending),
    erro: consultas.some((q) => q.isError),
    tentarDeNovo: () => consultas.forEach((q) => q.isError && q.refetch()),
  };
}
