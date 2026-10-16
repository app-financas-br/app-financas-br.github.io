import { createContext, useContext, useState, type ReactNode } from "react";
import { mesAnterior, periodoAtual, proximoMes, type Periodo } from "../../lib/datas";

type PeriodoContexto = Periodo & {
  setPeriodo: (p: Periodo) => void;
  anterior: () => void;
  proximo: () => void;
  irParaHoje: () => void;
};

const Contexto = createContext<PeriodoContexto | null>(null);

/** Mês e ano selecionados no topo. Toda consulta de lançamentos filtra por eles. */
export function PeriodoProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoAtual());

  return (
    <Contexto.Provider
      value={{
        ...periodo,
        setPeriodo,
        anterior: () => setPeriodo((p) => mesAnterior(p)),
        proximo: () => setPeriodo((p) => proximoMes(p)),
        irParaHoje: () => setPeriodo(periodoAtual()),
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function usePeriodo(): PeriodoContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("usePeriodo precisa estar dentro de <PeriodoProvider>");
  return ctx;
}
