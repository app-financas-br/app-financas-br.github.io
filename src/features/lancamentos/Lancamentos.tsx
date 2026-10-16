import { Link, useSearchParams } from "react-router";
import { FileUp } from "lucide-react";
import { Entradas } from "./Entradas";
import { ContasFixas } from "./ContasFixas";
import { Gastos } from "./Gastos";
import { t } from "../../i18n/pt-BR";

// "curto" aparece no celular (< 640 px) para as 3 abas caberem em 375 px sem rolagem
const ABAS = [
  { id: "entradas", rotulo: t.lanc.entradas, curto: t.lanc.entradas, Componente: Entradas },
  { id: "contas", rotulo: t.lanc.contasFixas, curto: t.lanc.contasCurto, Componente: ContasFixas },
  { id: "gastos", rotulo: t.lanc.gastos, curto: t.lanc.gastosCurto, Componente: Gastos },
] as const;

/** Planilha do mês: Entradas, Contas fixas e Gastos variáveis (aba fica na URL: #/lancamentos?aba=gastos). */
export function Lancamentos() {
  const [params, setParams] = useSearchParams();
  const ativa = ABAS.find((a) => a.id === params.get("aba")) ?? ABAS[2];
  const Componente = ativa.Componente;

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Sem barra de rolagem visível (o arrastar continua funcionando se um dia não couber) */}
      <div
        role="tablist"
        aria-label={t.nav.lancamentos}
        className="flex gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none] sm:mr-auto [&::-webkit-scrollbar]:hidden"
      >
        {ABAS.map((a) => {
          const selecionada = a.id === ativa.id;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              aria-selected={selecionada}
              onClick={() => setParams({ aba: a.id }, { replace: true })}
              aria-label={a.rotulo}
              className={`h-9 flex-1 whitespace-nowrap rounded-full border px-3 text-[length:var(--fs-md)] transition-colors duration-200 ease-app sm:flex-none sm:px-4 ${
                selecionada ? "border-border-glow bg-primary-soft text-primary-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              <span className="sm:hidden">{a.curto}</span>
              <span className="max-sm:hidden">{a.rotulo}</span>
            </button>
          );
        })}
      </div>
      <Link
        to="/importar"
        className="inline-flex h-9 items-center justify-center gap-2 self-end rounded-md border border-primary px-3 text-[length:var(--fs-sm)] text-primary-text transition-colors duration-200 ease-app hover:bg-primary-soft sm:self-auto"
      >
        <FileUp size={16} aria-hidden /> {t.importacao.abrir}
      </Link>
      </div>
      <div role="tabpanel">
        <Componente />
      </div>
    </div>
  );
}
