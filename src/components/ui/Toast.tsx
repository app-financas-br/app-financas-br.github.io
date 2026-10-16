import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

type Toast = {
  id: number;
  texto: string;
  tipo: "info" | "erro";
  acao?: { rotulo: string; onClick: () => void };
};

type ToastContexto = {
  mostrar: (t: Omit<Toast, "id">, duracaoMs?: number) => number;
  fechar: (id: number) => void;
};

const Contexto = createContext<ToastContexto | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id: number) => setToasts((l) => l.filter((t) => t.id !== id)), []);

  const mostrar = useCallback(
    (t: Omit<Toast, "id">, duracaoMs = 5000) => {
      const id = proximoId.current++;
      setToasts((l) => [...l.slice(-2), { ...t, id }]);
      window.setTimeout(() => fechar(id), duracaoMs);
      return id;
    },
    [fechar],
  );

  return (
    <Contexto.Provider value={{ mostrar, fechar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tipo === "erro" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-border-strong bg-elevated px-4 py-3 text-text shadow-[var(--shadow-card)]"
          >
            {t.tipo === "erro" ? (
              <CircleAlert size={18} className="shrink-0 text-danger" aria-hidden />
            ) : (
              <CircleCheck size={18} className="shrink-0 text-success" aria-hidden />
            )}
            <span className="flex-1">{t.texto}</span>
            {t.acao && (
              <button
                type="button"
                onClick={() => {
                  t.acao!.onClick();
                  fechar(t.id);
                }}
                className="rounded-md px-2 py-1 font-semibold text-primary-text hover:bg-primary-soft"
              >
                {t.acao.rotulo}
              </button>
            )}
            <button type="button" onClick={() => fechar(t.id)} aria-label="Fechar aviso" className="text-muted hover:text-text">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast(): ToastContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return ctx;
}
