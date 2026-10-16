import { nivelBarra } from "../../lib/planejamento";
import { t } from "../../i18n/pt-BR";

const cores = { normal: "bg-primary", atencao: "bg-warning", estourou: "bg-danger" } as const;

/** Barra realizado ÷ previsto: amarela a partir de 80%, vermelha acima de 100%. */
export function BarraGrupo({ nome, realizado, previsto }: { nome: string; realizado: number; previsto: number }) {
  const nivel = nivelBarra(realizado, previsto);
  const pct = previsto > 0 ? Math.round((realizado / previsto) * 100) : realizado > 0 ? 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={t.planejamento.progresso(nome, pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(pct, 100)}
      className="h-2 w-full overflow-hidden rounded-full bg-border-strong"
    >
      <div className={`h-full rounded-full transition-[width] duration-300 ease-app ${cores[nivel]}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
