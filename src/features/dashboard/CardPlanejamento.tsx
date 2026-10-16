import { Link } from "react-router";
import { Card, CardTitle } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import type { Periodo } from "../../lib/datas";
import { BarraGrupo } from "../planejamento/BarraGrupo";
import { usePlanejamentoMes } from "../planejamento/usePlanejamentoMes";
import { t } from "../../i18n/pt-BR";

/** Card pequeno do Dashboard: cada grupo com realizado / previsto e a barra. */
export function CardPlanejamento({ periodo, formatar, className = "" }: { periodo: Periodo; formatar: (c: number) => string; className?: string }) {
  const { calculo, carregando, erro, tentarDeNovo } = usePlanejamentoMes(periodo);

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <CardTitle className="mr-auto">{t.planejamento.doMes}</CardTitle>
        <Link to="/planejamento" className="text-[length:var(--fs-sm)] text-primary-text hover:underline">
          {t.planejamento.abrir}
        </Link>
      </div>
      {erro ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-danger">{t.planejamento.erro}</p>
          <Button variante="contorno" className="h-9" onClick={tentarDeNovo}>{t.dashboard.tentarDeNovo}</Button>
        </div>
      ) : carregando || !calculo ? (
        <Skeleton className="h-40" />
      ) : calculo.linhas.length === 0 ? (
        <p className="py-6 text-center text-muted">{t.planejamento.semGrupos}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {calculo.linhas.map(({ grupo, previsto, realizado }) => (
            <li key={grupo.id} className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 text-[length:var(--fs-sm)]">
                <span aria-hidden className="h-2 w-2 shrink-0 self-center rounded-sm" style={{ background: grupo.cor }} />
                <span className="min-w-0 flex-1 truncate text-text">{grupo.nome}</span>
                <span className="num whitespace-nowrap text-muted">
                  {formatar(realizado)} / {formatar(previsto)}
                </span>
              </div>
              <BarraGrupo nome={grupo.nome} realizado={realizado} previsto={previsto} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
