import { NavLink } from "react-router";
import { NAVEGACAO } from "../navegacao";
import { t } from "../../i18n/pt-BR";

const itens = NAVEGACAO.filter((i) => i.noCelular);

export function BottomNav() {
  return (
    <nav
      aria-label={t.nav.principal}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {itens.map(({ rota, curto, icone: Icone }) => (
          <li key={rota}>
            <NavLink
              to={rota}
              end={rota === "/"}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[length:var(--fs-xs)] transition-colors duration-200 ease-app ${
                  isActive ? "text-primary-text" : "text-muted hover:text-text"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full ${isActive ? "bg-primary-soft" : ""}`}>
                    <Icone size={20} aria-hidden />
                  </span>
                  <span className="max-w-full truncate px-1">{curto}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
