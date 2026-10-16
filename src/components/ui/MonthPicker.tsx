import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { mesmoPeriodo, periodoAtual } from "../../lib/datas";
import { t } from "../../i18n/pt-BR";

const botaoIcone =
  "flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors duration-200 ease-app hover:bg-card-hover hover:text-text";

/** Seletor de mês/ano: setas para navegar e um painel para escolher qualquer mês de qualquer ano. */
export function MonthPicker() {
  const { ano, mes, anterior, proximo, setPeriodo, irParaHoje } = usePeriodo();
  const [aberto, setAberto] = useState(false);
  const [anoPainel, setAnoPainel] = useState(ano);
  const raiz = useRef<HTMLDivElement>(null);
  const atual = periodoAtual();

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", fechar);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", fechar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative flex items-center rounded-md border border-border bg-card">
      <button type="button" onClick={anterior} aria-label={t.topbar.mesAnterior} className={botaoIcone}>
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setAnoPainel(ano);
          setAberto((a) => !a);
        }}
        aria-label={t.topbar.escolherMes}
        aria-expanded={aberto}
        className="flex h-9 min-w-[8.5rem] items-center justify-center gap-2 px-2 font-medium text-text hover:text-primary-text"
      >
        <CalendarDays size={16} className="text-muted" aria-hidden />
        <span className="num">
          {t.meses[mes - 1]} {ano}
        </span>
      </button>
      <button type="button" onClick={proximo} aria-label={t.topbar.proximoMes} className={botaoIcone}>
        <ChevronRight size={18} />
      </button>

      {aberto && (
        <div className="absolute top-full right-0 z-40 mt-2 w-64 rounded-lg border border-border-strong bg-elevated p-3 shadow-[var(--shadow-card)] max-sm:left-1/2 max-sm:right-auto max-sm:-translate-x-1/2">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => setAnoPainel((a) => a - 1)} aria-label={t.topbar.anoAnterior} className={botaoIcone}>
              <ChevronLeft size={18} />
            </button>
            <span className="num font-semibold text-text">{anoPainel}</span>
            <button type="button" onClick={() => setAnoPainel((a) => a + 1)} aria-label={t.topbar.proximoAno} className={botaoIcone}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {t.mesesCurtos.map((nome, i) => {
              const p = { ano: anoPainel, mes: i + 1 };
              const selecionado = mesmoPeriodo(p, { ano, mes });
              const ehAtual = mesmoPeriodo(p, atual);
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => {
                    setPeriodo(p);
                    setAberto(false);
                  }}
                  aria-pressed={selecionado}
                  className={`h-9 rounded-md border text-[length:var(--fs-md)] transition-colors duration-200 ease-app ${
                    selecionado
                      ? "border-border-glow bg-primary-soft text-primary-text"
                      : `border-transparent hover:bg-card-hover ${ehAtual ? "text-primary-text" : "text-text"}`
                  }`}
                >
                  {nome}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              irParaHoje();
              setAberto(false);
            }}
            className="mt-3 h-9 w-full rounded-md text-[length:var(--fs-sm)] text-primary-text hover:bg-card-hover"
          >
            {t.topbar.irParaHoje}
          </button>
        </div>
      )}
    </div>
  );
}
