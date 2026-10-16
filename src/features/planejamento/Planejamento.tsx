import { useState } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { Donut, LegendaDonut, type FatiaDonut } from "../../components/graficos/Donut";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { CelulaTexto, CelulaValor } from "../lancamentos/celulas";
import { CorCategoria } from "../categorias/Categorias";
import { corLivre, nomeLivre, nomeRepetido } from "../categorias/regrasCategoria";
import { usePreferencias } from "../preferencias/usePreferencias";
import { formatarMoeda, paraCentavos } from "../../lib/dinheiro";
import { avisoPercentual, formatarBp, parsePercentual } from "../../lib/planejamento";
import { BarraGrupo } from "./BarraGrupo";
import { useAplicarProximosMeses, useAtualizarGrupo, useCriarGrupo, useExcluirGrupoComDesfazer } from "./api";
import { usePlanejamentoMes } from "./usePlanejamentoMes";
import { t } from "../../i18n/pt-BR";

const campo = "h-9 w-full rounded-md border border-border-glow bg-input px-2 text-text outline-none";

/** Percentual que vira campo ao clicar; aceita "12,5" ou "12,5%". */
function CelulaPercentual({ bp, nome, onSalvar }: { bp: number; nome: string; onSalvar: (bp: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [invalido, setInvalido] = useState(false);
  const { mostrar } = useToast();

  const salvar = () => {
    const novo = parsePercentual(rascunho);
    if (novo === null) {
      setInvalido(true);
      mostrar({ tipo: "erro", texto: t.planejamento.percentualInvalido });
      return;
    }
    setEditando(false);
    if (novo !== bp) onSalvar(novo);
  };

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => { setRascunho(String(bp / 100).replace(".", ",")); setInvalido(false); setEditando(true); }}
        aria-label={`${t.planejamento.percentualDe(nome)}: ${formatarBp(bp)}`}
        className="num flex h-9 w-full items-center justify-end rounded-md px-2 font-medium text-text hover:bg-card-hover"
      >
        {formatarBp(bp)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="decimal"
      aria-label={t.planejamento.percentualDe(nome)}
      aria-invalid={invalido}
      onFocus={(e) => e.currentTarget.select()}
      className={`${campo} num text-right ${invalido ? "border-danger" : ""}`}
      value={rascunho}
      onChange={(e) => { setRascunho(e.target.value); setInvalido(false); }}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditando(false);
      }}
    />
  );
}

function TextoFalta({ previsto, realizado, fmt }: { previsto: number; realizado: number; fmt: (c: number) => string }) {
  const falta = previsto - realizado;
  return falta >= 0 ? (
    <span className="text-muted">{t.planejamento.faltaValor(fmt(falta))}</span>
  ) : (
    <span className="text-danger">{t.planejamento.passouValor(fmt(-falta))}</span>
  );
}

const colunas =
  "grid grid-cols-[minmax(0,1fr)_4rem_2.25rem] items-center gap-x-2 gap-y-1.5 md:grid-cols-[minmax(0,1.4fr)_5.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_2.25rem]";

export function Planejamento() {
  const { ano, mes } = usePeriodo();
  const periodo = { ano, mes };
  const { prefs } = usePreferencias();
  const fmt = (c: number) => formatarMoeda(c, prefs.moeda);
  const { mostrar } = useToast();
  const { calculo, salvar, carregando, erro, tentarDeNovo } = usePlanejamentoMes(periodo);
  const criarGrupo = useCriarGrupo();
  const atualizarGrupo = useAtualizarGrupo();
  const excluirGrupo = useExcluirGrupoComDesfazer();
  const aplicar = useAplicarProximosMeses();
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);
  const [novoId, setNovoId] = useState<string | null>(null);

  if (erro) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Aviso tipo="erro">{t.planejamento.erro}</Aviso>
        <Button variante="contorno" onClick={tentarDeNovo}>{t.dashboard.tentarDeNovo}</Button>
      </Card>
    );
  }
  if (carregando || !calculo) {
    return (
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-12" aria-busy aria-label={t.carregando}>
        <Skeleton className="h-40 lg:col-span-5" />
        <Skeleton className="h-40 lg:col-span-7" />
        <Skeleton className="h-80 lg:col-span-12" />
      </div>
    );
  }

  const { origem, renda, linhas, semGrupo, totalBp, sobra, futuros } = calculo;
  const grupos = linhas.map((l) => l.grupo);
  const aviso = avisoPercentual(totalBp);

  const erroGrupo = (e: unknown) => {
    console.error("[planejamento] grupo", e);
    mostrar({ tipo: "erro", texto: (e as { code?: string }).code === "23505" ? t.planejamento.nomeRepetido : t.lanc.erroSalvar });
  };
  const renomear = (id: string, nome: string) => {
    if (nomeRepetido(nome, grupos, id)) return mostrar({ tipo: "erro", texto: t.planejamento.nomeRepetido });
    atualizarGrupo.mutate({ id, campos: { nome } }, { onError: erroGrupo });
  };
  const adicionar = () =>
    criarGrupo.mutate(
      {
        nome: nomeLivre(t.planejamento.novoGrupo, grupos.map((g) => g.nome)),
        cor: corLivre(grupos.map((g) => g.cor)),
        ordem: Math.max(0, ...grupos.map((g) => g.ordem)) + 1,
      },
      { onSuccess: (g) => setNovoId(g.id), onError: erroGrupo },
    );

  const fatias: FatiaDonut[] = linhas
    .filter((l) => l.previsto > 0)
    .map((l) => ({ id: l.grupo.id, rotulo: l.grupo.nome, valor: l.previsto, cor: l.grupo.cor }));
  if (sobra > 0 && fatias.length > 0) fatias.push({ id: "nao-planejado", rotulo: t.planejamento.naoPlanejado, valor: sobra, cor: "var(--border-strong)" });

  const textoOrigem =
    origem.tipo === "proprio"
      ? t.planejamento.origemProprio
      : origem.tipo === "herdado"
        ? t.planejamento.origemHerdado(`${t.meses[origem.de.mes - 1]!.toLowerCase()} de ${origem.de.ano}`)
        : t.planejamento.origemEntradas;

  return (
    <div className="grid items-start gap-[var(--gap-grid)] lg:grid-cols-12">
      {/* Renda prevista + totais */}
      <Card className="flex flex-col gap-3 lg:col-span-5">
        <CardTitle>{t.planejamento.renda}</CardTitle>
        <div className="max-w-[16rem] text-[length:var(--fs-xl)]">
          <CelulaValor
            valor={renda / 100}
            moeda={prefs.moeda}
            rotulo={t.planejamento.rendaRotulo}
            onSalvar={(reais) => salvar({ renda: paraCentavos(reais) })}
            classeCor="text-text"
          />
        </div>
        <p className="text-[length:var(--fs-sm)] text-muted">{textoOrigem}</p>
        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div>
            <dt className="text-[length:var(--fs-xs)] text-muted">{t.planejamento.total}</dt>
            <dd className="num font-semibold text-text">{formatarBp(totalBp)}</dd>
            {aviso.tipo !== "ok" && (
              <dd role="status" className="text-[length:var(--fs-sm)] font-medium text-warning">
                {aviso.tipo === "faltam" ? t.planejamento.faltam(formatarBp(aviso.bp)) : t.planejamento.passou(formatarBp(aviso.bp))}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-[length:var(--fs-xs)] text-muted">{t.planejamento.sobra}</dt>
            <dd className={`num font-semibold ${sobra < 0 ? "text-danger" : "text-text"}`}>{fmt(sobra)}</dd>
          </div>
        </dl>
      </Card>

      {/* Distribuição da renda: legenda ao lado no computador, embaixo no celular */}
      <Card className="flex flex-col gap-4 lg:col-span-7">
        <CardTitle>{t.planejamento.distribuicao}</CardTitle>
        {fatias.length === 0 ? (
          <p className="py-6 text-center text-muted">{grupos.length === 0 ? t.planejamento.semGrupos : t.painel.semEntradas}</p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[11rem_1fr]">
            <Donut
              fatias={fatias}
              formatar={fmt}
              rotulo={t.planejamento.roscaDistribuicao(fmt(renda))}
              centro={
                <>
                  <span className="text-[length:var(--fs-xs)] text-muted">{t.planejamento.renda}</span>
                  <span className="num text-[length:var(--fs-sm)] font-semibold text-text">{fmt(renda)}</span>
                </>
              }
            />
            <LegendaDonut fatias={fatias} formatar={fmt} />
          </div>
        )}
      </Card>

      {/* Grupos: % editável, previsto × realizado */}
      <Card className="flex flex-col gap-3 lg:col-span-12">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="mr-auto">{t.planejamento.grupos}</CardTitle>
          <Button variante="fantasma" className="h-9" onClick={() => setConfirmarAplicar(true)}>
            <CalendarRange size={16} aria-hidden /> {t.planejamento.aplicar}
          </Button>
          <Button variante="contorno" className="h-9" onClick={adicionar} disabled={criarGrupo.isPending}>
            <Plus size={16} aria-hidden /> {t.planejamento.novoGrupo}
          </Button>
        </div>

        {linhas.length === 0 ? (
          <p className="py-6 text-center text-muted">{t.planejamento.semGrupos}</p>
        ) : (
          <ul className="flex flex-col">
            <li aria-hidden className={`${colunas} hidden border-b border-border pb-2 text-[length:var(--fs-xs)] tracking-wide text-muted uppercase md:grid`}>
              <span>{t.planejamento.grupos}</span>
              <span className="text-right">%</span>
              <span className="text-right">{t.planejamento.previsto}</span>
              <span className="text-right">{t.planejamento.realizado}</span>
              <span />
              <span />
            </li>
            {linhas.map(({ grupo, bp, previsto, realizado }) => (
              <li key={grupo.id} className={`${colunas} border-b border-border py-2 last:border-b-0`}>
                <div className="flex min-w-0 items-center gap-2">
                  <CorCategoria cor={grupo.cor} nome={grupo.nome} onSalvar={(cor) => atualizarGrupo.mutate({ id: grupo.id, campos: { cor } }, { onError: erroGrupo })} />
                  <div className="min-w-0 flex-1">
                    <CelulaTexto rotulo={t.planejamento.nomeGrupo} valor={grupo.nome} maxLength={40} abrirAoMontar={grupo.id === novoId} onSalvar={(nome) => renomear(grupo.id, nome)} />
                  </div>
                </div>
                <CelulaPercentual bp={bp} nome={grupo.nome} onSalvar={(novo) => salvar({ grupoId: grupo.id, bp: novo })} />
                <span className="num hidden text-right text-text md:block">{fmt(previsto)}</span>
                <span className="num hidden text-right text-text md:block">{fmt(realizado)}</span>
                <div className="order-last col-span-3 flex flex-col gap-1 md:order-none md:col-span-1">
                  <BarraGrupo nome={grupo.nome} realizado={realizado} previsto={previsto} />
                  <p className="num flex flex-wrap justify-between gap-x-2 text-[length:var(--fs-xs)]">
                    <span className="text-muted md:hidden">
                      {fmt(realizado)} / {fmt(previsto)}
                    </span>
                    <TextoFalta previsto={previsto} realizado={realizado} fmt={fmt} />
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => excluirGrupo(grupo)}
                  aria-label={t.planejamento.excluirGrupo(grupo.nome)}
                  title={t.planejamento.excluirGrupo(grupo.nome)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-faint hover:bg-card-hover hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
            {semGrupo > 0 && (
              <li className={`${colunas} py-2 text-muted`} title={t.planejamento.semGrupoDica}>
                <span className="truncate px-2">{t.planejamento.semGrupo}</span>
                <span />
                <span className="hidden md:block" />
                <span className="num hidden text-right md:block">{fmt(semGrupo)}</span>
                <span className="order-last col-span-3 text-[length:var(--fs-xs)] md:order-none md:col-span-1">
                  <span className="num md:hidden">{fmt(semGrupo)} · </span>
                  {t.planejamento.semGrupoDica}
                </span>
                <span />
              </li>
            )}
          </ul>
        )}
      </Card>

      <Modal
        aberto={confirmarAplicar}
        titulo={t.planejamento.aplicarTitulo}
        onFechar={() => setConfirmarAplicar(false)}
        rodape={
          <>
            <Button variante="fantasma" onClick={() => setConfirmarAplicar(false)}>{t.planejamento.cancelar}</Button>
            <Button
              disabled={aplicar.isPending}
              onClick={() =>
                aplicar.mutate(periodo, {
                  onSuccess: () => {
                    setConfirmarAplicar(false);
                    mostrar({ tipo: "info", texto: t.planejamento.aplicarOk });
                  },
                  onError: (e) => {
                    console.error("[planejamento] aplicar", e);
                    mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
                  },
                })
              }
            >
              {t.planejamento.confirmar}
            </Button>
          </>
        }
      >
        <p className="text-muted">{t.planejamento.aplicarTexto(futuros)}</p>
      </Modal>
    </div>
  );
}
