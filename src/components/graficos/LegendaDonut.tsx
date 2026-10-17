// Legenda da rosca, separada do gráfico para não puxar o Recharts junto (o gráfico carrega sob demanda).

export type FatiaDonut = { id: string; rotulo: string; valor: number; cor: string };

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
