import { useCallback, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { Skeleton } from "../../components/ui/Skeleton";
import { AreaEvolucao, Donut, Sparkline } from "../../components/graficos/sobDemanda";
import { LegendaDonut, type FatiaDonut } from "../../components/graficos/LegendaDonut";
import { Gauge } from "../../components/graficos/Gauge";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { useCategorias } from "../categorias/useCategorias";
import { formatarMoeda, formatarMovimento, formatarPercentual, paraCentavos, type Moeda, formatarCompacto } from "../../lib/dinheiro";
import { rotuloSaude, saudeMes, variacaoPercentual } from "../../lib/calculos";
import { acumuladoDiario, agruparPequenas, ateHoje, contasAVencer, diaNoPeriodo, porCategoria, ultimosLancamentos } from "../../lib/dashboard";
import { hoje as hojeLocal, parseData } from "../../lib/datas";
import { useDadosDashboard } from "./useDadosDashboard";
import { CardPlanejamento } from "./CardPlanejamento";
import { CardSaldoContas } from "./CardSaldoContas";
import { useAssistenteVoz } from "../voz/AssistenteVoz";
import { Mic } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { t } from "../../i18n/pt-BR";


// ---------------------------------------------------------------------------

function KpiCard({
  titulo,
  icone: Icone,
  corIcone,
  centavos,
  anterior,
  sobeEhBom,
  serie,
  corSerie,
  moeda,
}: {
  titulo: string;
  icone: LucideIcon;
  corIcone: string;
  centavos: number;
  /** Valor do mês anterior em centavos; null = mês anterior ainda carregando. */
  anterior: number | null;
  sobeEhBom: boolean;
  serie: number[];
  corSerie: string;
  moeda: Moeda;
}) {
  const variacao = anterior === null ? null : variacaoPercentual(centavos, anterior);
  const bom = variacao === null ? null : variacao === 0 ? null : variacao > 0 === sobeEhBom;
  return (
    <Card className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${corIcone}`}>
          <Icone size={18} aria-hidden />
        </span>
        <CardTitle className="leading-tight">{titulo}</CardTitle>
      </div>
      {/* Valor nunca é cortado: no celular (2 colunas) usa fonte menor */}
      <p className="num text-[length:var(--fs-lg)] leading-tight font-semibold whitespace-nowrap text-text sm:text-[length:var(--fs-xl)] lg:text-[length:var(--fs-kpi)]">
        {formatarMoeda(centavos, moeda)}
      </p>
      <Sparkline valores={serie} cor={corSerie} />
      <p className="flex items-center gap-1 text-[length:var(--fs-xs)] text-muted">
        {anterior === null ? null : variacao === null ? (
          // Mês anterior zerado: não há % possível, mostra o valor de referência
          t.painel.anteriorFoi(formatarMoeda(anterior, moeda))
        ) : (
          <>
            <span className={`num flex items-center font-medium ${bom === null ? "text-muted" : bom ? "text-success" : "text-danger"}`}>
              {variacao >= 0 ? <ArrowUpRight size={14} aria-hidden /> : <ArrowDownRight size={14} aria-hidden />}
              {formatarPercentual(variacao, 1)}
            </span>
            {t.painel.vsMesAnterior}
          </>
        )}
      </p>
    </Card>
  );
}

function BarraVoz() {
  const { abrir } = useAssistenteVoz();
  return (
    <Card className="flex items-center gap-3 !py-3">
      <button
        type="button"
        onClick={abrir}
        aria-label={t.voz.barra}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary shadow-[var(--glow-primary)] transition-transform duration-200 ease-app hover:scale-105"
      >
        <Mic size={20} aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text">{t.voz.barra}</p>
        <p className="truncate text-[length:var(--fs-sm)] text-muted">{t.voz.exemplo}</p>
      </div>
      <Button variante="contorno" className="h-9 max-sm:hidden" onClick={abrir}>
        {t.voz.gravar}
      </Button>
    </Card>
  );
}

function CardVazio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-muted">{children}</p>;
}

// ---------------------------------------------------------------------------

export function Dashboard() {
  const { state } = useLocation();
  const aviso = (state as { aviso?: string } | null)?.aviso;
  const { ano, mes } = usePeriodo();
  const periodo = { ano, mes };
  const { prefs, atual, anterior, aVencer, recentes, conferidoComBanco } = useDadosDashboard(periodo);
  const { data: categorias = [] } = useCategorias();
  // Fatia da rosca "Gastos por categoria" aberta no modal (id da categoria, "sem" ou "outras")
  const [fatiaAberta, setFatiaAberta] = useState<string | null>(null);
  const fecharFatia = useCallback(() => setFatiaAberta(null), []);
  const moeda = prefs.moeda;
  const fmt = (c: number) => formatarMoeda(c, moeda);
  const hoje = hojeLocal();

  if (atual.erro) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Aviso tipo="erro">{t.painel.erro}</Aviso>
        <Button variante="contorno" onClick={atual.tentarDeNovo}>
          {t.dashboard.tentarDeNovo}
        </Button>
      </Card>
    );
  }
  if (atual.carregando || !atual.resumo) {
    return (
      <div className="grid grid-cols-2 gap-[var(--gap-grid)] lg:grid-cols-4" aria-busy aria-label={t.carregando}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
        <Skeleton className="col-span-2 h-72 lg:col-span-3" />
        <Skeleton className="col-span-2 h-72 lg:col-span-1" />
      </div>
    );
  }

  const r = atual.resumo;
  const ra = anterior.resumo;
  const conta = (pago: boolean) => pago || !prefs.so_pago;

  // Séries diárias acumuladas (no mês atual, até hoje)
  const serie = (itens: { valor: number | string; dia: number }[]) => ateHoje(acumuladoDiario(itens, periodo), periodo, hoje);
  const sEntradas = serie(atual.entradas.filter((e) => e.recebido).map((e) => ({ valor: e.valor, dia: diaNoPeriodo(e.data, periodo) })));
  const sSaidas = serie([
    ...atual.contas.filter((c) => conta(c.pago)).map((c) => ({ valor: c.valor, dia: diaNoPeriodo(c.vencimento, periodo) })),
    ...atual.gastos.filter((g) => conta(g.pago)).map((g) => ({ valor: g.valor, dia: diaNoPeriodo(g.data, periodo) })),
  ]);
  const sInvest = serie(atual.investimentos.map((i) => ({ valor: i.valor, dia: diaNoPeriodo(i.data, periodo) })));
  const sDisponivel = sEntradas.map((v, i) => v - (sSaidas[i] ?? 0) - (sInvest[i] ?? 0));

  const saidas = r.contasFixas + r.gastosVariaveis;
  const saidasAnt = ra ? ra.contasFixas + ra.gastosVariaveis : 0;

  // Rosca do Disponível: para onde foram as entradas recebidas
  const fatiasDisp: FatiaDonut[] = [
    { id: "fixas", rotulo: t.lanc.contasFixas, valor: r.contasFixas, cor: "var(--chart-2)" },
    { id: "gastos", rotulo: t.lanc.gastos, valor: r.gastosVariaveis, cor: "var(--chart-4)" },
    { id: "invest", rotulo: t.painel.investido, valor: Math.max(0, r.investido), cor: "var(--chart-5)" },
    { id: "disp", rotulo: t.painel.disponivel, valor: Math.max(0, r.disponivel), cor: "var(--primary)" },
  ].filter((f) => f.valor > 0);

  // Gastos por categoria (contas fixas + gastos do mês): sem as zeradas; fatias < 3% viram "Outras"
  const saidasContadas = [
    ...atual.contas.filter((c) => conta(c.pago)).map((c) => ({ ...c, quando: c.vencimento })),
    ...atual.gastos.filter((g) => conta(g.pago)).map((g) => ({ ...g, quando: g.data })),
  ];
  const { fatias: fatiasGrandes, outras } = agruparPequenas(porCategoria(saidasContadas), 3);
  const nomeCat = (id: string | null) => categorias.find((c) => c.id === id);
  const idFatia = (categoriaId: string | null) => categoriaId ?? "sem";
  const fatiasCat: FatiaDonut[] = fatiasGrandes.map((f) => ({
    id: idFatia(f.categoriaId),
    rotulo: nomeCat(f.categoriaId)?.nome ?? t.lanc.semCategoria,
    valor: f.centavos,
    cor: nomeCat(f.categoriaId)?.cor ?? "var(--chart-7)",
  }));
  if (outras.length > 0) {
    fatiasCat.push({ id: "outras", rotulo: t.painel.outras, valor: outras.reduce((s, f) => s + f.centavos, 0), cor: "var(--chart-7)" });
  }
  // Lançamentos da fatia tocada ("Outras" junta as categorias agrupadas)
  const idsAbertos = new Set(fatiaAberta === "outras" ? outras.map((f) => idFatia(f.categoriaId)) : fatiaAberta ? [fatiaAberta] : []);
  const itensFatia = saidasContadas
    .filter((s) => idsAbertos.has(idFatia(s.categoria_id)))
    .sort((a, b) => paraCentavos(b.valor) - paraCentavos(a.valor));
  const tituloFatia = fatiasCat.find((f) => f.id === fatiaAberta)?.rotulo ?? "";

  const saude = saudeMes(r);
  const lista = contasAVencer(aVencer.data ?? [], hoje);
  const ultimos = ultimosLancamentos([
    { tipo: "entrada", itens: recentes.entrada.data ?? [] },
    { tipo: "conta", itens: recentes.conta.data ?? [] },
    { tipo: "gasto", itens: recentes.gasto.data ?? [] },
    { tipo: "investimento", itens: recentes.investimento.data ?? [] },
  ]);

  const dadosEvolucao = sEntradas.map((v, i) => ({ x: i + 1, entradas: v, saidas: sSaidas[i] ?? 0 }));
  const mesCurto = t.mesesCurtos[mes - 1];

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      {aviso && <Aviso tipo="sucesso">{aviso}</Aviso>}

      {/* Lançar por voz: barra fixa no topo (docs/02-design.md) */}
      <BarraVoz />

      {/* Ordem no celular: KPIs → Disponível → Contas a vencer → Evolução → Categorias → Últimos → Saúde */}
      <div className="grid grid-cols-2 gap-[var(--gap-grid)] lg:grid-cols-12">
        <div className="col-span-1 lg:col-span-3">
          <KpiCard titulo={t.painel.entradas} icone={TrendingUp} corIcone="bg-success/15 text-success" centavos={r.entradasRecebidas}
            anterior={ra ? ra.entradasRecebidas : null} sobeEhBom serie={sEntradas} corSerie="var(--success)" moeda={moeda} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <KpiCard titulo={t.painel.saidas} icone={TrendingDown} corIcone="bg-danger/15 text-danger" centavos={saidas}
            anterior={ra ? saidasAnt : null} sobeEhBom={false} serie={sSaidas} corSerie="var(--danger)" moeda={moeda} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <KpiCard titulo={t.painel.investido} icone={PiggyBank} corIcone="bg-info/15 text-info" centavos={r.investido}
            anterior={ra ? ra.investido : null} sobeEhBom serie={sInvest} corSerie="var(--info)" moeda={moeda} />
        </div>
        <div className="col-span-1 lg:col-span-3">
          <KpiCard titulo={t.painel.disponivel} icone={Wallet} corIcone="bg-primary-soft text-primary" centavos={r.disponivel}
            anterior={ra ? ra.disponivel : null} sobeEhBom serie={sDisponivel} corSerie="var(--primary)" moeda={moeda} />
        </div>

        {/* Evolução do mês */}
        <Card className="order-3 col-span-2 flex flex-col gap-3 lg:order-none lg:col-span-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <CardTitle className="mr-auto">{t.painel.evolucao}</CardTitle>
            <span className="flex items-center gap-1.5 text-[length:var(--fs-xs)] text-muted">
              <span aria-hidden className="h-0.5 w-4 rounded bg-success" /> {t.painel.entradas}
            </span>
            <span className="flex items-center gap-1.5 text-[length:var(--fs-xs)] text-muted">
              <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-danger" /> {t.painel.saidas}
            </span>
          </div>
          {r.entradasRecebidas === 0 && saidas === 0 ? (
            <CardVazio>{t.painel.semLancamentos}</CardVazio>
          ) : (
            <AreaEvolucao
              dados={dadosEvolucao}
              series={[
                { chave: "entradas", rotulo: t.painel.entradas, cor: "var(--success)" },
                { chave: "saidas", rotulo: t.painel.saidas, cor: "var(--danger)", tracejada: true },
              ]}
              formatar={fmt}
              formatarCurto={formatarCompacto}
              rotuloX={(d) => `${d} ${mesCurto}`}
            />
          )}
        </Card>

        {/* Disponível para gastar */}
        <Card className="order-1 col-span-2 flex flex-col gap-4 lg:order-none lg:col-span-4">
          <div className="flex items-center gap-2">
            <CardTitle className="mr-auto">{t.painel.disponivelTitulo}</CardTitle>
            {conferidoComBanco === true && (
              <CheckCircle2 size={16} className="text-success" aria-label={t.painel.conferido} />
            )}
          </div>
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[11rem_1fr] lg:grid-cols-1">
            <Donut
              fatias={fatiasDisp}
              formatar={fmt}
              rotulo={t.painel.roscaDisponivel(fmt(r.disponivel))}
              centro={
                <>
                  <span className="text-[length:var(--fs-xs)] text-muted">{t.painel.disponivel}</span>
                  <span className={`num font-semibold ${r.disponivel < 0 ? "text-danger" : "text-text"}`}>{fmt(r.disponivel)}</span>
                </>
              }
            />
            {fatiasDisp.length > 0 ? <LegendaDonut fatias={fatiasDisp} formatar={fmt} /> : <p className="text-muted">{t.painel.semEntradas}</p>}
          </div>
          {r.entradasAReceber > 0 && (
            <p className="text-[length:var(--fs-sm)] text-warning">{t.painel.aReceber(fmt(r.entradasAReceber))}</p>
          )}
        </Card>

        {/* Gastos por categoria */}
        <Card className="order-4 col-span-2 flex flex-col gap-4 lg:order-none lg:col-span-4">
          <CardTitle>{t.painel.porCategoria}</CardTitle>
          {fatiasCat.length === 0 ? (
            <CardVazio>{t.painel.semGastos}</CardVazio>
          ) : (
            <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[10rem_1fr] lg:grid-cols-1 xl:grid-cols-[10rem_1fr]">
              <Donut
                fatias={fatiasCat}
                formatar={fmt}
                rotulo={t.painel.roscaCategorias(fmt(saidas))}
                onSelecionar={setFatiaAberta}
                centro={
                  <>
                    <span className="text-[length:var(--fs-xs)] text-muted">{t.lanc.total}</span>
                    <span className="num text-[length:var(--fs-sm)] font-semibold text-text">{fmt(saidas)}</span>
                  </>
                }
              />
              <LegendaDonut fatias={fatiasCat} formatar={fmt} onSelecionar={setFatiaAberta} rotuloAcao={t.painel.verLancamentos} />
            </div>
          )}
        </Card>

        {/* Saúde do mês */}
        <Card className="order-7 col-span-2 flex flex-col gap-2 lg:order-none lg:col-span-4">
          <CardTitle>{t.painel.saude}</CardTitle>
          <Gauge
            valor={saude}
            rotulo={saude === null ? t.painel.semEntradasCurto : rotuloSaude(saude)}
            descricao={saude === null ? t.painel.saudeSemDados : t.painel.saudeDescricao(saude, rotuloSaude(saude))}
          />
          <p className="text-center text-[length:var(--fs-sm)] text-muted">{t.painel.saudeExplicacao}</p>
        </Card>

        {/* Contas a vencer */}
        <Card className="order-2 col-span-2 flex flex-col gap-3 lg:order-none lg:col-span-4">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-warning" aria-hidden />
            <CardTitle className="mr-auto">{t.painel.aVencer}</CardTitle>
            <Link to="/lancamentos?aba=contas" className="text-[length:var(--fs-sm)] text-primary-text hover:underline">
              {t.painel.verTodas}
            </Link>
          </div>
          {aVencer.isPending ? (
            <Skeleton className="h-24" />
          ) : lista.length === 0 ? (
            <CardVazio>{t.painel.nadaAVencer}</CardVazio>
          ) : (
            <ul className="flex flex-col">
              {lista.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-border py-2 last:border-b-0">
                  {c.atrasada && <AlertTriangle size={16} className="shrink-0 text-danger" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">{c.descricao}</p>
                    <p className={`text-[length:var(--fs-xs)] ${c.atrasada ? "text-danger" : c.diasAte <= 1 ? "text-warning" : "text-muted"}`}>
                      {c.atrasada ? t.painel.atrasada(-c.diasAte) : c.diasAte === 0 ? t.painel.venceHoje : t.painel.venceEm(c.diasAte)}
                      {" · "}
                      {parseData(c.vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </p>
                  </div>
                  <span className="num font-medium text-text">{fmt(paraCentavos(c.valor))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Planejamento do mês */}
        <CardPlanejamento className="order-5 col-span-2 lg:order-none lg:col-span-4" periodo={periodo} formatar={fmt} />

        {/* Saldo em contas */}
        <CardSaldoContas className="order-5 col-span-2 lg:order-none lg:col-span-4" formatar={fmt} />

        {/* Últimos lançamentos */}
        <Card className="order-6 col-span-2 flex flex-col gap-3 lg:order-none lg:col-span-4">
          <CardTitle>{t.painel.ultimos}</CardTitle>
          {ultimos.length === 0 ? (
            <CardVazio>{t.painel.semLancamentos}</CardVazio>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2 lg:grid-cols-1">
              {ultimos.map((u) => {
                const entra = u.tipo === "entrada" || (u.tipo === "investimento" && u.centavos < 0);
                return (
                  <li key={`${u.tipo}-${u.id}`} className="flex items-center gap-3 border-b border-border py-2">
                    <span className="w-20 shrink-0 text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{t.painel.tipos[u.tipo]}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{u.descricao}</span>
                    <span className={`num font-medium ${u.centavos === 0 ? "text-muted" : entra ? "text-success" : "text-danger"}`}>
                      {formatarMovimento(entra ? Math.abs(u.centavos) : -Math.abs(u.centavos), moeda)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal aberto={fatiaAberta !== null} titulo={t.painel.lancamentosDe(tituloFatia)} onFechar={fecharFatia}>
        {itensFatia.length === 0 ? (
          <p className="text-muted">{t.painel.nenhumLancamento}</p>
        ) : (
          <ul className="-mx-1 flex max-h-[60dvh] flex-col overflow-y-auto">
            {itensFatia.map((i) => (
              <li key={i.id} className="flex items-center gap-3 border-b border-border px-1 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text">{i.descricao}</p>
                  <p className="text-[length:var(--fs-xs)] text-muted">
                    {[
                      i.quando ? parseData(i.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : null,
                      fatiaAberta === "outras" ? nomeCat(i.categoria_id)?.nome ?? t.lanc.semCategoria : null,
                      i.pago ? null : t.painel.pendente,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="num font-medium text-text">{fmt(paraCentavos(i.valor))}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
