// Metas (docs/01-produto.md): %, quanto falta e quanto guardar por mês até o prazo. Puro, em centavos.
// Metas não entram em nenhum cálculo do mês.

import { paraCentavos } from "./dinheiro";
import { parseData } from "./datas";

type Valor = number | string;

/** % reservado do alvo, de 0 a 100 (inteiro). Alvo zero conta como 100% quando há algo reservado. */
export function pctMeta(reservado: Valor, alvo: Valor): number {
  const r = paraCentavos(reservado);
  const a = paraCentavos(alvo);
  if (a <= 0) return r > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, Math.floor((r * 100) / a)));
}

/** Meses que ainda dá para guardar até o prazo, contando o mês atual. 0 = prazo vencido. */
export function mesesAtePrazo(hoje: string, prazo: string): number {
  if (prazo < hoje) return 0;
  const h = parseData(hoje);
  const p = parseData(prazo);
  return (p.getFullYear() - h.getFullYear()) * 12 + (p.getMonth() - h.getMonth()) + 1;
}

export type PlanoMeta =
  | { situacao: "concluida" | "atingida" }
  | { situacao: "sem_prazo"; falta: number }
  | { situacao: "vencida"; falta: number }
  | { situacao: "em_dia"; falta: number; meses: number; porMes: number };

/** Quanto falta e quanto guardar por mês (arredondado para cima, em centavos). */
export function planoMeta(m: { valor_alvo: Valor; reservado: Valor; prazo: string | null; concluida: boolean }, hoje: string): PlanoMeta {
  if (m.concluida) return { situacao: "concluida" };
  const falta = paraCentavos(m.valor_alvo) - paraCentavos(m.reservado);
  if (falta <= 0) return { situacao: "atingida" };
  if (!m.prazo) return { situacao: "sem_prazo", falta };
  const meses = mesesAtePrazo(hoje, m.prazo);
  if (meses === 0) return { situacao: "vencida", falta };
  return { situacao: "em_dia", falta, meses, porMes: Math.ceil(falta / meses) };
}
