import { Area, Bar, CartesianGrid, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PontoGrafico = { rotulo: string; patrimonio: number; liquido: number };

/**
 * Patrimônio no fim de cada mês (linha com área em degradê) e o líquido aportado no mês
 * (barras embaixo, como o volume de um gráfico de mercado: verde aporte, vermelho resgate).
 */
export function GraficoPatrimonio({
  dados,
  formatar,
  formatarCurto,
  rotuloPatrimonio,
  rotuloLiquido,
}: {
  dados: PontoGrafico[];
  formatar: (c: number) => string;
  formatarCurto: (c: number) => string;
  rotuloPatrimonio: string;
  rotuloLiquido: string;
}) {
  const maxBarra = Math.max(1, ...dados.map((d) => Math.abs(d.liquido)));
  return (
    <div className="h-56 w-full md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="patrimonio-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="rotulo" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="p" tickFormatter={formatarCurto} tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          {/* Barras numa escala própria, ocupando só o terço de baixo */}
          <YAxis yAxisId="b" hide domain={[-maxBarra, maxBarra * 3]} />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: 8, color: "var(--text)" }}
            formatter={(v, nome) => [formatar(Number(v)), nome === "patrimonio" ? rotuloPatrimonio : rotuloLiquido]}
          />
          <Bar yAxisId="b" dataKey="liquido" barSize={10} radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {dados.map((d, i) => (
              <Cell key={i} fill={d.liquido >= 0 ? "var(--success)" : "var(--danger)"} fillOpacity={0.6} />
            ))}
          </Bar>
          <Area yAxisId="p" type="monotone" dataKey="patrimonio" stroke="var(--primary)" strokeWidth={2} fill="url(#patrimonio-area)" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
