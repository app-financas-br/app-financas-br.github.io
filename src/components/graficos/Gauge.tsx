import { useId } from "react";

/**
 * Medidor semicircular 0–100. O arco vai de verde (0) a vermelho (100):
 * quanto mais comprometido, mais vermelho. O número e o rótulo vêm no centro
 * (o texto sempre acompanha a cor).
 */
export function Gauge({ valor, rotulo, descricao }: { valor: number | null; rotulo: string; descricao: string }) {
  const id = useId().replace(/:/g, "");
  const R = 80;
  const C = Math.PI * R; // comprimento do semicírculo
  const pct = valor === null ? 0 : Math.min(100, Math.max(0, valor));
  // Ponto do marcador no arco (ângulo de 180° a 0°)
  const ang = Math.PI * (1 - pct / 100);
  const mx = 100 + R * Math.cos(ang);
  const my = 100 - R * Math.sin(ang);

  return (
    <div className="mx-auto w-full max-w-[14rem]">
      <svg viewBox="0 0 200 124" className="w-full" role="img" aria-label={descricao}>
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--gauge-high)" />
            <stop offset="55%" stopColor="var(--gauge-mid)" />
            <stop offset="100%" stopColor="var(--gauge-low)" />
          </linearGradient>
        </defs>
        {/* trilho */}
        <path d={`M 20 100 A ${R} ${R} 0 0 1 180 100`} fill="none" stroke="var(--border-strong)" strokeWidth="12" strokeLinecap="round" />
        {/* parte preenchida até o valor */}
        {valor !== null && (
          <path
            d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
            fill="none"
            stroke={`url(#g-${id})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(C * pct) / 100} ${C}`}
          />
        )}
        {valor !== null && <circle cx={mx} cy={my} r="7" fill="var(--text)" stroke="var(--bg-card)" strokeWidth="3" />}
        <text x="100" y="86" textAnchor="middle" className="num" fill="var(--text)" fontSize="30" fontWeight="600">
          {valor === null ? "—" : Math.round(pct)}
        </text>
        <text x="100" y="106" textAnchor="middle" fill="var(--text-muted)" fontSize="12">
          {rotulo}
        </text>
        {/* abaixo das pontas arredondadas do arco (que vão até y≈106) */}
        <text x="20" y="121" textAnchor="middle" fill="var(--text-faint)" fontSize="10">0</text>
        <text x="180" y="121" textAnchor="middle" fill="var(--text-faint)" fontSize="10">100</text>
      </svg>
    </div>
  );
}
