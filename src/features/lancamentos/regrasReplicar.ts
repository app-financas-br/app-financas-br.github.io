// Regras puras de "Replicar mês" e "Repetir até dezembro" (sem banco, para testar).

import { datasParcelas, periodosParcelas } from "../../lib/calculos";
import type { Periodo } from "../../lib/datas";
import { normalizar } from "../../lib/categorizar";
import type { ContaFixa, Entrada } from "./tipos";

export type TabelaReplicavel = "entradas" | "contas_fixas";
export type Linha = Record<string, unknown>;

/** Mesma data k meses depois, com o dia limitado ao fim do mês (31/10 + 1 → 30/11). */
export function deslocarData(data: string | null, meses: number): string | null {
  return data ? datasParcelas(data, meses + 1)[meses]! : null;
}

/** Distância em meses entre dois períodos (b − a). */
export function distanciaMeses(a: Periodo, b: Periodo): number {
  return (b.ano - a.ano) * 12 + (b.mes - a.mes);
}

/**
 * Linhas para copiar ao mês seguinte.
 * - Contas fixas: sem parcelas; chegam como Pendente, mesmo dia de vencimento e categoria.
 * - Entradas: sem o "Saldo do mês anterior"; chegam como "A receber" (só contam no Disponível
 *   quando a pessoa marcar como recebidas).
 */
export function linhasReplicarMes(tabela: TabelaReplicavel, itens: (Entrada | ContaFixa)[], destino: Periodo): Linha[] {
  if (tabela === "entradas") {
    return (itens as Entrada[])
      .filter((e) => e.origem !== "saldo_anterior")
      .map((e) => ({
        ano: destino.ano,
        mes: destino.mes,
        descricao: e.descricao,
        valor: e.valor,
        recebido: false,
        data: deslocarData(e.data, 1),
        origem: "replicado",
      }));
  }
  return (itens as ContaFixa[])
    .filter((c) => !c.grupo_parcela)
    .map((c) => ({
      ano: destino.ano,
      mes: destino.mes,
      descricao: c.descricao,
      valor: c.valor,
      pago: false,
      vencimento: deslocarData(c.vencimento, 1),
      categoria_id: c.categoria_id,
      origem: "replicado",
    }));
}

/** Meses depois do mês da conta até dezembro do mesmo ano. */
export function mesesAteDezembro(conta: Periodo): Periodo[] {
  const restantes = 12 - conta.mes;
  return restantes > 0 ? periodosParcelas(conta, restantes + 1).slice(1) : [];
}

/**
 * Meses (dentre `meses`) que já têm uma conta com a mesma descrição
 * (ignorando maiúsculas, acentos e espaços extras).
 */
export function mesesComMesmaConta(
  descricao: string,
  meses: Periodo[],
  existentes: { ano: number; mes: number; descricao: string }[],
): Periodo[] {
  const alvo = normalizar(descricao);
  return meses.filter((p) => existentes.some((e) => e.ano === p.ano && e.mes === p.mes && normalizar(e.descricao) === alvo));
}

/** Linhas de "Repetir até dezembro" para os meses escolhidos (o vencimento acompanha a distância de cada mês). */
export function linhasRepetir(conta: ContaFixa, meses: Periodo[]): Linha[] {
  const origem = { ano: conta.ano, mes: conta.mes };
  return meses.map((p) => ({
    ano: p.ano,
    mes: p.mes,
    descricao: conta.descricao,
    valor: conta.valor,
    pago: false,
    vencimento: deslocarData(conta.vencimento, distanciaMeses(origem, p)),
    categoria_id: conta.categoria_id,
    origem: "replicado",
  }));
}
