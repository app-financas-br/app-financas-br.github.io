import { useLocation } from "react-router";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { Skeleton } from "../../components/ui/Skeleton";
import { useCategorias, type Categoria } from "../categorias/useCategorias";
import { t } from "../../i18n/pt-BR";

function ListaCategorias({ titulo, itens }: { titulo: string; itens: Categoria[] }) {
  return (
    <Card>
      <CardTitle>{titulo}</CardTitle>
      {itens.length === 0 ? (
        <p className="mt-4 text-muted">{t.dashboard.semCategorias}</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {itens.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-full border border-border bg-input px-3 py-1.5 text-text"
            >
              {/* cor vinda do banco (padrão do sistema), só como marcador */}
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />
              {c.nome}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Dashboard() {
  const { state } = useLocation();
  const aviso = (state as { aviso?: string } | null)?.aviso;
  const { data, isPending, isError, refetch } = useCategorias();

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}

      <Card>
        <CardTitle>{t.dashboard.boasVindas}</CardTitle>
        <p className="mt-2 text-muted">{t.dashboard.resumo}</p>
      </Card>

      {isPending ? (
        <div className="grid gap-[var(--gap-grid)] md:grid-cols-2" aria-busy aria-label={t.carregando}>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : isError ? (
        <Card className="flex flex-col items-start gap-3">
          <Aviso tipo="erro">{t.dashboard.erroCategorias}</Aviso>
          <Button variante="contorno" onClick={() => refetch()}>
            {t.dashboard.tentarDeNovo}
          </Button>
        </Card>
      ) : (
        <div className="grid gap-[var(--gap-grid)] md:grid-cols-2">
          <ListaCategorias titulo={t.dashboard.categoriasGasto} itens={data.filter((c) => c.tipo === "gasto")} />
          <ListaCategorias titulo={t.dashboard.categoriasInvest} itens={data.filter((c) => c.tipo === "investimento")} />
        </div>
      )}
    </div>
  );
}
