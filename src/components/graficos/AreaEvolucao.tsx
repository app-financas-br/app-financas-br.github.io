import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SerieEvolucao = { chave: string; rotulo: string; cor: string; tracejada?: boolean };

/**
 * Evolução acumulada por dia: uma área por série (degradê 35% → 0%), grade quase invisível,
 * um único eixo Y, crosshair + tooltip com o dia e o valor de cada série.
 */
export function AreaEvolucao({
  dados,
  series,
  formatar,
  formatarCurto,
  rotuloX,
}: {
  dados: Record<string, number>[];
  series: SerieEvolucao[];
  formatar: (v: number) => string;
  formatarCurto: (v: number) => string;
  rotuloX: (x: number) => string;
}) {
  return (
    <div className="h-56 w-full md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.chave} id={`ev-${s.chave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.cor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.cor} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="x"
            tickFormatter={rotuloX}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tickFormatter={formatarCurto}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "var(--text-faint)", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-md)",
              color: "var(--text)",
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            itemStyle={{ color: "var(--text)" }}
            labelFormatter={(x) => rotuloX(Number(x))}
            formatter={(v, nome) => [formatar(Number(v)), series.find((s) => s.chave === nome)?.rotulo ?? String(nome)]}
          />
          {series.map((s) => (
            <Area
              key={s.chave}
              type="monotone"
              dataKey={s.chave}
              stroke={s.cor}
              strokeWidth={2}
              strokeDasharray={s.tracejada ? "6 4" : undefined}
              fill={`url(#ev-${s.chave})`}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--bg-card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
