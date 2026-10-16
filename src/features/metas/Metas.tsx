import { useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { Skeleton } from "../../components/ui/Skeleton";
import { CelulaData, CelulaTexto, CelulaValor } from "../lancamentos/celulas";
import { nomeLivre } from "../categorias/regrasCategoria";
import { usePreferencias } from "../preferencias/usePreferencias";
import { formatarMoeda, paraCentavos } from "../../lib/dinheiro";
import { hoje as hojeLocal } from "../../lib/datas";
import { pctMeta, planoMeta } from "../../lib/metas";
import { useAtualizarMeta, useCriarMeta, useExcluirMetaComDesfazer, useMetas, type Meta } from "./api";
import { t } from "../../i18n/pt-BR";

const botaoIcone = "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-card-hover";

function CardMeta({ meta, abrirAoMontar }: { meta: Meta; abrirAoMontar: boolean }) {
  const { prefs } = usePreferencias();
  const fmt = (c: number) => formatarMoeda(c, prefs.moeda);
  const atualizar = useAtualizarMeta();
  const excluir = useExcluirMetaComDesfazer();
  const salvar = (campos: Parameters<typeof atualizar.mutate>[0]["campos"]) => atualizar.mutate({ id: meta.id, campos });
  const pct = pctMeta(meta.reservado, meta.valor_alvo);
  const plano = planoMeta(meta, hojeLocal());

  const texto =
    plano.situacao === "em_dia"
      ? t.metas.porMes(fmt(plano.porMes), plano.meses)
      : plano.situacao === "sem_prazo"
        ? t.metas.semPrazo
        : plano.situacao === "vencida"
          ? t.metas.vencida
          : plano.situacao === "atingida"
            ? t.metas.atingida
            : t.metas.concluida;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 font-semibold">
          <CelulaTexto rotulo={t.metas.nome} valor={meta.nome} maxLength={80} abrirAoMontar={abrirAoMontar} onSalvar={(nome) => salvar({ nome })} />
        </div>
        <button type="button" className={`${botaoIcone} hover:text-success`} onClick={() => salvar({ concluida: true })}
          aria-label={t.metas.concluir(meta.nome)} title={t.metas.concluir(meta.nome)}>
          <CheckCircle2 size={18} />
        </button>
        <button type="button" className={`${botaoIcone} hover:text-danger`} onClick={() => excluir(meta)}
          aria-label={t.metas.excluir(meta.nome)} title={t.metas.excluir(meta.nome)}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[length:var(--fs-xl)] font-semibold text-text">{pct}%</span>
        <span className="num text-[length:var(--fs-sm)] text-muted">
          {t.metas.resumo(fmt(paraCentavos(meta.reservado)), fmt(paraCentavos(meta.valor_alvo)))}
        </span>
      </div>
      <div role="progressbar" aria-label={t.metas.progresso(meta.nome, pct)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        className="h-2 w-full overflow-hidden rounded-full bg-border-strong">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-app ${pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[length:var(--fs-sm)] ${plano.situacao === "vencida" ? "text-danger" : plano.situacao === "atingida" ? "text-success" : "text-muted"}`}>
        {plano.situacao === "em_dia" || plano.situacao === "sem_prazo" || plano.situacao === "vencida" ? `${t.metas.falta(fmt(plano.falta))} · ` : ""}
        {texto}
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-3 text-[length:var(--fs-sm)] sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-[length:var(--fs-xs)] text-muted">{t.metas.reservado}</dt>
          <dd><CelulaValor valor={meta.reservado} moeda={prefs.moeda} rotulo={t.metas.reservadoDe(meta.nome)} classeCor="text-text" onSalvar={(reservado) => salvar({ reservado })} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[length:var(--fs-xs)] text-muted">{t.metas.alvo}</dt>
          <dd><CelulaValor valor={meta.valor_alvo} moeda={prefs.moeda} rotulo={t.metas.alvoDe(meta.nome)} classeCor="text-text" onSalvar={(valor_alvo) => salvar({ valor_alvo })} /></dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-[length:var(--fs-xs)] text-muted">{t.metas.prazo}</dt>
          <dd><CelulaData rotulo={t.metas.prazoDe(meta.nome)} valor={meta.prazo} onSalvar={(prazo) => salvar({ prazo })} /></dd>
        </div>
      </dl>
    </Card>
  );
}

export function Metas() {
  const { data, isPending, isError, refetch } = useMetas();
  const { prefs } = usePreferencias();
  const criar = useCriarMeta();
  const atualizar = useAtualizarMeta();
  const excluir = useExcluirMetaComDesfazer();
  const [novaId, setNovaId] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="grid gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3" aria-busy aria-label={t.carregando}>
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Aviso tipo="erro">{t.metas.erro}</Aviso>
        <Button variante="contorno" onClick={() => refetch()}>{t.dashboard.tentarDeNovo}</Button>
      </Card>
    );
  }

  const abertas = data.filter((m) => !m.concluida);
  const concluidas = data.filter((m) => m.concluida);
  const nova = () =>
    criar.mutate({ nome: nomeLivre(t.metas.novaNome, data.map((m) => m.nome)) }, { onSuccess: (m) => setNovaId(m.id) });

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      <div className="flex justify-end">
        <Button variante="contorno" className="h-10 max-sm:w-full" onClick={nova} disabled={criar.isPending}>
          <Plus size={16} aria-hidden /> {t.metas.nova}
        </Button>
      </div>

      {abertas.length === 0 ? (
        <Card><p className="py-6 text-center text-muted">{t.metas.vazio}</p></Card>
      ) : (
        <div className="grid items-start gap-[var(--gap-grid)] sm:grid-cols-2 lg:grid-cols-3">
          {abertas.map((m) => <CardMeta key={m.id} meta={m} abrirAoMontar={m.id === novaId} />)}
        </div>
      )}

      {concluidas.length > 0 && (
        <Card className="flex flex-col gap-1">
          <p className="text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{t.metas.concluidas}</p>
          {concluidas.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1 text-muted">
              <CheckCircle2 size={16} className="shrink-0 text-success" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{m.nome}</span>
              <span className="num text-[length:var(--fs-sm)]">{formatarMoeda(paraCentavos(m.valor_alvo), prefs.moeda)}</span>
              <button type="button" className={`${botaoIcone} hover:text-text`} onClick={() => atualizar.mutate({ id: m.id, campos: { concluida: false } })}
                aria-label={t.metas.reabrir(m.nome)} title={t.metas.reabrir(m.nome)}>
                <RotateCcw size={16} />
              </button>
              <button type="button" className={`${botaoIcone} hover:text-danger`} onClick={() => excluir(m)}
                aria-label={t.metas.excluir(m.nome)} title={t.metas.excluir(m.nome)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
