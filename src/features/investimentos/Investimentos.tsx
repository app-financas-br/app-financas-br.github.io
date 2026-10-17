import { useId, useMemo, useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { useToast } from "../../components/ui/Toast";
import { Donut, GraficoPatrimonio } from "../../components/graficos/sobDemanda";
import { LegendaDonut, type FatiaDonut } from "../../components/graficos/LegendaDonut";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { usePreferencias, useSalvarSaldoInicial } from "../preferencias/usePreferencias";
import { useCategorias, type Categoria } from "../categorias/useCategorias";
import { useContasBancarias } from "../contas-bancarias/api";
import { useAtualizarLancamento, useCriarLancamento, useExcluirComDesfazer, useLancamentos } from "../lancamentos/api";
import { CelulaData, CelulaTexto, CelulaValor, Pill, SelectCategoria } from "../lancamentos/celulas";
import { Celula, Linha, Quadro } from "../lancamentos/Quadro";
import type { Investimento } from "../lancamentos/tipos";
import { normalizar } from "../../lib/categorizar";
import { patrimonio } from "../../lib/calculos";
import { dataPadrao } from "../../lib/datas";
import { deCentavos, formatarMoeda, paraCentavos, parseValor } from "../../lib/dinheiro";
import { patrimonioPorMes, resumoInvestimentos, saldoInicialParaPatrimonio, saldoPorCategoria } from "../../lib/investimentos";
import { useTodosInvestimentos } from "./api";
import { t } from "../../i18n/pt-BR";

const GRADE = "minmax(0,1fr) 9.5rem 9.5rem 6.5rem 8.5rem 2.5rem";
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const campo = "h-11 w-full rounded-md border border-border bg-input px-3 text-text outline-none focus:border-border-glow [&>option]:bg-elevated";

/** Resgate: escolhe a categoria de origem, valor, data e o destino (uma conta, reserva ou gasto planejado). */
function ModalResgate({ aberto, onFechar, categorias }: { aberto: boolean; onFechar: () => void; categorias: Categoria[] }) {
  const { ano, mes } = usePeriodo();
  const periodo = { ano, mes };
  const { prefs } = usePreferencias();
  const { mostrar } = useToast();
  const { data: contas = [] } = useContasBancarias();
  const criar = useCriarLancamento<Investimento>("investimentos", periodo);
  const contasDestino = contas.filter((c) => c.ativa && c.tipo !== "cartao_credito");
  const ids = { origem: useId(), valor: useId(), data: useId(), destino: useId(), outro: useId() };
  const [origem, setOrigem] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => dataPadrao(periodo));
  const [destino, setDestino] = useState("");
  const [outro, setOutro] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const visiveis = categorias.filter((c) => !c.oculta);
  const origemId = origem || visiveis[0]?.id || "";
  const destinoEscolhido = destino || (contasDestino[0] ? `conta:${contasDestino[0].id}` : "reserva");

  const salvar = () => {
    const centavos = parseValor(valor);
    if (centavos === null || centavos <= 0) return setErro(t.investimentos.valorInvalido);
    const cat = visiveis.find((c) => c.id === origemId);
    const conta = destinoEscolhido.startsWith("conta:") ? contasDestino.find((c) => `conta:${c.id}` === destinoEscolhido) : undefined;
    const textoDestino = conta
      ? conta.nome
      : destinoEscolhido === "outro"
        ? outro.trim() || t.investimentos.destinos.outro
        : t.investimentos.destinos[destinoEscolhido as "reserva" | "planejado"];
    criar.mutate(
      {
        descricao: t.investimentos.descricaoResgate(cat?.nome ?? ""),
        valor: deCentavos(-centavos), // resgate = valor negativo (devolve ao Disponível)
        data,
        categoria_id: cat?.id ?? null,
        destino: textoDestino.slice(0, 80),
        // Para uma conta minha: o dinheiro entra no saldo dela
        ...(conta ? { conta_bancaria_id: conta.id } : {}),
      },
      {
        onSuccess: () => {
          mostrar({ tipo: "info", texto: t.investimentos.feito(formatarMoeda(centavos, prefs.moeda)) });
          setValor("");
          setErro(null);
          onFechar();
        },
      },
    );
  };

  return (
    <Modal
      aberto={aberto}
      titulo={t.investimentos.modalTitulo}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>{t.investimentos.cancelar}</Button>
          <Button onClick={salvar} disabled={criar.isPending}>{t.investimentos.confirmar}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label htmlFor={ids.origem} className="flex flex-col gap-1.5 text-[length:var(--fs-sm)] font-medium text-muted">
          {t.investimentos.origem}
          <select id={ids.origem} className={campo} value={origemId} onChange={(e) => setOrigem(e.target.value)}>
            {visiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor={ids.valor} className="flex flex-col gap-1.5 text-[length:var(--fs-sm)] font-medium text-muted">
            {t.investimentos.valor}
            <input id={ids.valor} inputMode="decimal" className={`${campo} num`} value={valor} aria-invalid={!!erro}
              onChange={(e) => { setValor(e.target.value); setErro(null); }} placeholder="0,00" />
          </label>
          <label htmlFor={ids.data} className="flex flex-col gap-1.5 text-[length:var(--fs-sm)] font-medium text-muted">
            {t.investimentos.data}
            <input id={ids.data} type="date" className={`${campo} num [color-scheme:dark]`} value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
          </label>
        </div>
        <label htmlFor={ids.destino} className="flex flex-col gap-1.5 text-[length:var(--fs-sm)] font-medium text-muted">
          {t.investimentos.para}
          <select id={ids.destino} className={campo} value={destinoEscolhido} onChange={(e) => setDestino(e.target.value)}>
            {contasDestino.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
            <option value="reserva">{t.investimentos.destinos.reserva}</option>
            <option value="planejado">{t.investimentos.destinos.planejado}</option>
            <option value="outro">{t.investimentos.destinos.outro}</option>
          </select>
        </label>
        {destinoEscolhido === "outro" && (
          <input aria-label={t.investimentos.destinos.outro} className={campo} maxLength={80} value={outro} onChange={(e) => setOutro(e.target.value)} />
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Modal>
  );
}

export function Investimentos() {
  const { ano, mes } = usePeriodo();
  const periodo = { ano, mes };
  const { prefs } = usePreferencias();
  const fmt = (c: number) => formatarMoeda(c, prefs.moeda);
  const { data: todasCategorias = [] } = useCategorias();
  const categorias = useMemo(() => todasCategorias.filter((c) => c.tipo === "investimento"), [todasCategorias]);
  const todos = useTodosInvestimentos();
  const lista = useLancamentos<Investimento>("investimentos", periodo);
  const criar = useCriarLancamento<Investimento>("investimentos", periodo);
  const atualizar = useAtualizarLancamento<Investimento>("investimentos", periodo);
  const excluir = useExcluirComDesfazer<Investimento>("investimentos", periodo);
  const salvarSaldo = useSalvarSaldoInicial();
  const { mostrar } = useToast();
  const [busca, setBusca] = useState("");
  const [novoId, setNovoId] = useState<string | null>(null);
  const [resgatando, setResgatando] = useState(false);

  const itens = lista.data ?? [];
  const visiveis = useMemo(() => {
    const b = normalizar(busca);
    return b ? itens.filter((i) => normalizar(i.descricao).includes(b)) : itens;
  }, [itens, busca]);
  const resumo = resumoInvestimentos(itens);
  const salvar = (id: string, campos: Partial<Investimento>) => atualizar.mutate({ id, campos });

  const total = todos.data ? patrimonio(prefs.saldo_inicial, todos.data) : 0;
  const pontos = todos.data
    ? patrimonioPorMes(prefs.saldo_inicial, todos.data, ano).map((p) => ({ rotulo: t.mesesCurtos[p.mes - 1]!, patrimonio: p.patrimonio, liquido: p.liquido }))
    : [];
  const nomeCat = (id: string | null) => categorias.find((c) => c.id === id);
  const fatias: FatiaDonut[] = todos.data
    ? saldoPorCategoria(todos.data).map((f) => ({
        id: f.categoriaId ?? "sem",
        rotulo: nomeCat(f.categoriaId)?.nome ?? t.lanc.semCategoria,
        valor: f.centavos,
        cor: nomeCat(f.categoriaId)?.cor ?? "var(--chart-7)",
      }))
    : [];

  const editarPatrimonio = (reais: number) =>
    todos.data &&
    salvarSaldo.mutate(deCentavos(saldoInicialParaPatrimonio(paraCentavos(reais), prefs.saldo_inicial, todos.data)), {
      onError: (e) => {
        console.error("[investimentos] saldo inicial", e);
        mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
      },
    });

  return (
    <div className="grid items-start gap-[var(--gap-grid)] lg:grid-cols-12">
      <ModalResgate aberto={resgatando} onFechar={() => setResgatando(false)} categorias={categorias} />

      {/* Patrimônio + evolução no ano */}
      <Card className="flex flex-col gap-3 lg:col-span-8">
        <CardTitle>{t.investimentos.patrimonio}</CardTitle>
        {todos.isError ? (
          <Aviso tipo="erro">{t.investimentos.erro}</Aviso>
        ) : todos.isPending ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="max-w-[16rem] text-[length:var(--fs-xl)]">
              <CelulaValor valor={total / 100} moeda={prefs.moeda} rotulo={t.investimentos.patrimonioRotulo} classeCor="text-text" onSalvar={editarPatrimonio} />
            </div>
            <p className="text-[length:var(--fs-sm)] text-muted">{t.investimentos.ajudaPatrimonio}</p>
            <p className="text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{t.investimentos.evolucao(ano)}</p>
            <GraficoPatrimonio
              dados={pontos}
              formatar={fmt}
              formatarCurto={(c) => compacto.format(c / 100)}
              rotuloPatrimonio={t.investimentos.patrimonio}
              rotuloLiquido={t.investimentos.liquidoMes}
            />
          </>
        )}
      </Card>

      {/* Saldo por categoria */}
      <Card className="flex flex-col gap-4 lg:col-span-4">
        <CardTitle>{t.investimentos.porCategoria}</CardTitle>
        {todos.isPending ? (
          <Skeleton className="h-48" />
        ) : fatias.length === 0 ? (
          <p className="py-6 text-center text-muted">{t.investimentos.semCategorias}</p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[10rem_1fr] lg:grid-cols-1">
            <Donut
              fatias={fatias}
              formatar={fmt}
              rotulo={t.investimentos.porCategoria}
              centro={
                <>
                  <span className="text-[length:var(--fs-xs)] text-muted">{t.lanc.total}</span>
                  <span className="num text-[length:var(--fs-sm)] font-semibold text-text">{fmt(fatias.reduce((s, f) => s + f.valor, 0))}</span>
                </>
              }
            />
            <LegendaDonut fatias={fatias} formatar={fmt} />
          </div>
        )}
      </Card>

      {/* Aportes e resgates do mês */}
      <div className="lg:col-span-12">
        <Quadro
          titulo={t.investimentos.doMes}
          acaoCabecalho={
            <Button variante="contorno" className="h-10 max-sm:w-full" onClick={() => setResgatando(true)} disabled={categorias.length === 0}>
              <ArrowDownToLine size={16} aria-hidden /> {t.investimentos.novoResgate}
            </Button>
          }
          busca={busca}
          onBusca={setBusca}
          onAdicionar={() =>
            criar.mutate(
              { data: dataPadrao(periodo), categoria_id: categorias.find((c) => !c.oculta)?.id ?? null },
              { onSuccess: (n) => setNovoId(n.id) },
            )
          }
          adicionando={criar.isPending}
          estado={lista.isPending ? "carregando" : lista.isError ? "erro" : visiveis.length === 0 ? "vazio" : "ok"}
          onTentarDeNovo={() => lista.refetch()}
          colunas={[
            { rotulo: t.lanc.descricao },
            { rotulo: t.lanc.data },
            { rotulo: t.investimentos.categoria },
            { rotulo: t.lanc.tipo },
            { rotulo: t.lanc.valor, alinhar: "direita" },
            { rotulo: "" },
          ]}
          grade={GRADE}
          moeda={prefs.moeda}
          vazio={busca ? t.lanc.nadaEncontrado : t.investimentos.vazio}
          totais={[
            { rotulo: t.investimentos.aportes, centavos: resumo.aportes, cor: "text-success" },
            { rotulo: t.investimentos.resgates, centavos: resumo.resgates, cor: "text-danger" },
            { rotulo: t.investimentos.liquido, centavos: resumo.liquido },
          ]}
        >
          {visiveis.map((i) => {
            const centavos = paraCentavos(i.valor);
            const resgate = centavos < 0;
            return (
              <Linha
                key={i.id}
                grade={GRADE}
                onExcluir={() => excluir(i)}
                descricao={
                  <CelulaTexto rotulo={t.lanc.descricao} valor={i.descricao} abrirAoMontar={i.id === novoId} onSalvar={(descricao) => salvar(i.id, { descricao })} />
                }
                extras={
                  <>
                    <Celula className="w-[9.5rem] md:w-auto">
                      <CelulaData rotulo={t.lanc.data} valor={i.data} onSalvar={(data) => salvar(i.id, { data })} />
                    </Celula>
                    <Celula className="w-[9.5rem] md:w-auto">
                      <SelectCategoria valor={i.categoria_id} categorias={categorias} onSalvar={(categoria_id) => salvar(i.id, { categoria_id })} />
                    </Celula>
                    <Celula className="flex flex-col items-start gap-0.5">
                      <Pill
                        cor={resgate ? "laranja" : "verde"}
                        rotulo={t.investimentos.tipoDe(i.descricao, resgate ? t.investimentos.resgate : t.investimentos.aporte)}
                        onClick={() => salvar(i.id, { valor: deCentavos(-centavos) })}
                      >
                        {resgate ? t.investimentos.resgate : t.investimentos.aporte}
                      </Pill>
                      {resgate && i.destino && (
                        <span className="max-w-full truncate px-1 text-[length:var(--fs-xs)] text-muted" title={i.destino}>
                          {t.investimentos.destino(i.destino)}
                        </span>
                      )}
                    </Celula>
                  </>
                }
                valor={
                  <CelulaValor
                    rotulo={t.lanc.valor}
                    moeda={prefs.moeda}
                    valor={Math.abs(centavos) / 100}
                    classeCor={resgate ? "text-warning" : "text-info"}
                    onSalvar={(reais) => salvar(i.id, { valor: resgate ? -reais : reais })}
                  />
                }
              />
            );
          })}
        </Quadro>
      </div>
    </div>
  );
}
