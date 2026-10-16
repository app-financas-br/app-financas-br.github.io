import type { ReactNode } from "react";
import { BarChart3, Mic, ShieldCheck, Target } from "lucide-react";
import { Logo } from "../../components/ui/Logo";
import { t } from "../../i18n/pt-BR";

const icones = [BarChart3, Mic, Target, ShieldCheck];

/** Moldura das telas sem login: card central + faixa de recursos no rodapé. */
export function AuthLayout({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-app">
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <div className="card">
            <h1 className="text-[length:var(--fs-xl)] font-semibold text-text">{titulo}</h1>
            <p className="mt-1 mb-6 text-muted">{subtitulo}</p>
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-6">
        <ul className="mx-auto grid max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
          {t.auth.recursos.map((texto, i) => {
            const Icone = icones[i] ?? ShieldCheck;
            return (
              <li key={texto} className="flex items-center gap-2.5 text-[length:var(--fs-sm)] uppercase tracking-wide text-muted">
                <Icone size={20} className="shrink-0 text-primary" aria-hidden />
                {texto}
              </li>
            );
          })}
        </ul>
      </footer>
    </div>
  );
}
