import { NavLink } from "react-router";
import { Mic } from "lucide-react";
import { NAVEGACAO } from "../navegacao";
import { Logo } from "../../components/ui/Logo";
import { Button } from "../../components/ui/Button";
import { useAssistenteVoz } from "../../features/voz/AssistenteVoz";
import { t } from "../../i18n/pt-BR";

export function Sidebar() {
  const { abrir: abrirVoz } = useAssistenteVoz();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[var(--sidebar-w)] shrink-0 flex-col border-r border-border bg-sidebar px-3 py-5 lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav aria-label={t.nav.principal} className="mt-8 flex flex-col gap-1">
        {NAVEGACAO.map(({ rota, titulo, icone: Icone }) => (
          <NavLink
            key={rota}
            to={rota}
            end={rota === "/"}
            className={({ isActive }) =>
              `flex h-10 items-center gap-3 rounded-md border px-3 transition-colors duration-200 ease-app ${
                isActive
                  ? "border-border-glow bg-primary-soft text-primary-text"
                  : "border-transparent text-muted hover:bg-card-hover hover:text-text"
              }`
            }
          >
            <Icone size={18} aria-hidden />
            <span className="truncate">{titulo}</span>
          </NavLink>
        ))}
      </nav>

      {/* Assistente de voz: a gravação chega na Fase 2 */}
      <div className="mt-auto rounded-lg border border-border bg-card p-3">
        <p className="text-[length:var(--fs-xs)] font-semibold uppercase tracking-wide text-primary-text">{t.voz.titulo}</p>
        <div className="my-4 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary shadow-[var(--glow-primary)]">
            <Mic size={24} aria-hidden />
          </span>
        </div>
        <p className="mb-3 text-center text-text">{t.voz.frase}</p>
        <Button variante="contorno" className="h-9 w-full" onClick={abrirVoz}>
          {t.voz.gravar}
        </Button>
      </div>
    </aside>
  );
}
