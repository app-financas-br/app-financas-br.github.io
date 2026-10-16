import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

/** Mini-série decorativa do KPI (o número do card é o conteúdo; por isso fica escondida de leitores de tela). */
export function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const id = useId().replace(/:/g, "");
  const dados = valores.map((v, i) => ({ i, v }));
  if (dados.length < 2) return <div className="h-10" aria-hidden />;

  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={2} fill={`url(#sp-${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
