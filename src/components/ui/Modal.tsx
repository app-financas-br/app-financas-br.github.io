import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Diálogo acessível: fecha com Esc ou clicando fora; foco vai para dentro ao abrir e volta ao fechar. */
export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  rodape,
}: {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.querySelector<HTMLElement>("select, input, button:not([data-fechar])")?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      anterior?.focus();
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-app/70 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="w-full max-w-md rounded-lg border border-border-strong bg-elevated p-5 shadow-[var(--shadow-card)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-[length:var(--fs-lg)] font-semibold text-text">
            {titulo}
          </h2>
          <button type="button" data-fechar onClick={onFechar} aria-label="Fechar" className="text-muted hover:text-text">
            <X size={18} />
          </button>
        </div>
        {children}
        {rodape && <div className="mt-5 flex flex-wrap justify-end gap-2">{rodape}</div>}
      </div>
    </div>
  );
}
