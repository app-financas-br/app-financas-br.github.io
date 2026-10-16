import { useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export type FatiaDonut = { id: string; rotulo: string; valor: number; cor: string };

/**
 * Rosca com total no centro. Fatias separadas por 2px da cor do card (stroke) e a legenda
 * (nome + valor + %) fica ao lado em quem usa o componente — a cor nunca é o único sinal.
 * Passar o mouse/foco numa fatia mostra o nome e o valor no centro.
 */
export function Donut({
  fatias,
  centro,
  formatar,
  rotulo,
  onSelecionar,
}: {
  fatias: FatiaDonut[];
  centro: ReactNode;
  formatar: (v: number) => string;
  rotulo: string;
  /** Tocar numa fatia (a legenda tem o mesmo comando como botão, para teclado). */
  onSelecionar?: (id: string) => void;
}) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const destaque = ativa !== null ? fatias[ativa] : null;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[11rem]" role="img" aria-label={rotulo}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={total > 0 ? fatias : [{ id: "vazio", rotulo: "", valor: 1, cor: "var(--border-strong)" }]}
            dataKey="valor"
            nameKey="rotulo"
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--bg-card)"
            strokeWidth={2}
            isAnimationActive={false}
            onMouseEnter={(_, i) => total > 0 && setAtiva(i)}
            onMouseLeave={() => setAtiva(null)}
            onClick={(_, i) => total > 0 && fatias[i] && onSelecionar?.(fatias[i].id)}
            className={onSelecionar ? "cursor-pointer" : undefined}
          >
            {(total > 0 ? fatias : [{ id: "vazio", cor: "var(--border-strong)" }]).map((f, i) => (
              <Cell key={f.id} fill={f.cor} opacity={ativa === null || ativa === i ? 1 : 0.35} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        {destaque ? (
          <>
            <span className="max-w-full truncate text-[length:var(--fs-xs)] text-muted">{destaque.rotulo}</span>
            <span className="num font-semibold text-text">{formatar(destaque.valor)}</span>
            <span className="num text-[length:var(--fs-xs)] text-muted">{Math.round((destaque.valor / total) * 100)}%</span>
          </>
        ) : (
          centro
        )}
      </div>
    </div>
  );
}

/** Legenda da rosca: bolinha + nome + valor + %. */
export function LegendaDonut({
  fatias,
  formatar,
  onSelecionar,
  rotuloAcao,
}: {
  fatias: FatiaDonut[];
  formatar: (v: number) => string;
  onSelecionar?: (id: string) => void;
  rotuloAcao?: (rotulo: string) => string;
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  return (
    <ul className="flex flex-col gap-1">
      {fatias.map((f) => {
        const conteudo = (
          <>
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.cor }} />
            <span className="min-w-0 flex-1 truncate text-left text-text">{f.rotulo}</span>
            <span className="num text-muted">{formatar(f.valor)}</span>
            <span className="num w-10 text-right text-muted">{total > 0 ? Math.round((f.valor / total) * 100) : 0}%</span>
          </>
        );
        return (
          <li key={f.id} className="text-[length:var(--fs-sm)]">
            {onSelecionar ? (
              <button
                type="button"
                onClick={() => onSelecionar(f.id)}
                aria-label={rotuloAcao?.(f.rotulo)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1 transition-colors duration-150 ease-app hover:bg-card-hover"
              >
                {conteudo}
              </button>
            ) : (
              <div className="flex items-center gap-2">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
