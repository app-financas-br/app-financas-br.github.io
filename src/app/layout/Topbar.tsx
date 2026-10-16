import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Bell, LogOut, Settings, User } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../providers/AuthProvider";
import { tituloDaRota } from "../navegacao";
import { MonthPicker } from "../../components/ui/MonthPicker";
import { t } from "../../i18n/pt-BR";

const botaoRedondo =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors duration-200 ease-app hover:text-text";

function MenuConta() {
  const { session } = useAuth();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

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
    <div ref={raiz} className="relative">
      <button type="button" onClick={() => setAberto((a) => !a)} aria-label={t.topbar.menuConta} aria-expanded={aberto} className={botaoRedondo}>
        <User size={18} />
      </button>
      {aberto && (
        <div className="absolute top-full right-0 z-40 mt-2 w-60 rounded-lg border border-border-strong bg-elevated p-2 shadow-[var(--shadow-card)]">
          <p className="truncate px-2 py-2 text-[length:var(--fs-sm)] text-muted">{session?.user.email}</p>
          <Link
            to="/configuracoes"
            onClick={() => setAberto(false)}
            className="flex h-10 items-center gap-2 rounded-md px-2 text-text hover:bg-card-hover"
          >
            <Settings size={16} aria-hidden /> {t.nav.configuracoes}
          </Link>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-danger hover:bg-card-hover"
          >
            <LogOut size={16} aria-hidden /> {t.topbar.sair}
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { pathname } = useLocation();

  return (
    <header className="flex flex-wrap items-center gap-3 px-4 pt-4 md:px-6 md:pt-6">
      <h1 className="mr-auto text-[length:var(--fs-xl)] font-semibold text-text">{tituloDaRota(pathname)}</h1>
      <div className="flex items-center gap-2 max-sm:order-last max-sm:w-full max-sm:justify-center">
        <MonthPicker />
      </div>
      {/* Contas a vencer: o contador chega na Fase 1 */}
      <button type="button" aria-label={t.topbar.avisos} className={botaoRedondo}>
        <Bell size={18} />
      </button>
      <MenuConta />
    </header>
  );
}
