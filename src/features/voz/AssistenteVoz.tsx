import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// O painel (gravador, formulário, envio) só é baixado quando a pessoa abre a voz
const PainelVoz = lazy(() => import("./PainelVoz").then((m) => ({ default: m.PainelVoz })));

const Contexto = createContext<{ abrir: () => void } | null>(null);

/** Abre o assistente de voz de qualquer tela (barra lateral, Dashboard, botão flutuante). */
export function useAssistenteVoz() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAssistenteVoz precisa estar dentro de <AssistenteVozProvider>");
  return ctx;
}

/** Guarda o estado "aberto" e monta o painel só quando necessário (o microfone só liga ao abrir). */
export function AssistenteVozProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberto && (
        <Suspense fallback={null}>
          <PainelVoz onFechar={fechar} />
        </Suspense>
      )}
    </Contexto.Provider>
  );
}
