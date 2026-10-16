import { useMemo, useState } from "react";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { usePreferencias } from "../preferencias/usePreferencias";
import { paraCentavos } from "../../lib/dinheiro";
import { dataPadrao, hoje } from "../../lib/datas";
import { normalizar } from "../../lib/categorizar";
import { useAtualizarLancamento, useCriarLancamento, useExcluirComDesfazer, useLancamentos } from "./api";
import { CelulaData, CelulaTexto, CelulaValor, Pill, SelectCategoria } from "./celulas";
import { Copy, Layers, Repeat } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { BotaoAcao, Celula, Linha, Quadro } from "./Quadro";
import { ModalExcluirParcela, ModalParcelar } from "./parcelas";
import { ModalReplicarMes, ModalRepetirAteDezembro } from "./replicar";
import { useCategoriasGasto } from "./useCategoriasGasto";
import type { ContaFixa } from "./tipos";
import { t } from "../../i18n/pt-BR";

const GRADE = "minmax(0,1fr) 10rem 9.5rem 7rem 8.5rem 7.5rem";

/** Etiqueta "2/10" ao lado da descrição de uma parcela. */
export function EtiquetaParcela({ num, total }: { num: number | null; total: number | null }) {
  if (!num || !total) return null;
  return (
    <span className="num shrink-0 rounded-full bg-card-hover px-2 py-0.5 text-[length:var(--fs-xs)] text-muted" title={t.lanc.parcela}>
      {num}/{total}
    </span>
  );
}

export function ContasFixas() {
  const { ano, mes, setPeriodo } = usePeriodo();
  const periodo = { ano, mes };
  const [replicando, setReplicando] = useState(false);
  const [repetindo, setRepetindo] = useState<ContaFixa | null>(null);
  const { prefs } = usePreferencias();
  const { categorias, auto, salvarRegra } = useCategoriasGasto();
  const lista = useLancamentos<ContaFixa>("contas_fixas", periodo);
  const criar = useCriarLancamento<ContaFixa>("contas_fixas", periodo);
  const atualizar = useAtualizarLancamento<ContaFixa>("contas_fixas", periodo);
  const excluir = useExcluirComDesfazer<ContaFixa>("contas_fixas", periodo);
  const [busca, setBusca] = useState("");
  const [novoId, setNovoId] = useState<string | null>(null);
  const [parcelando, setParcelando] = useState<ContaFixa | null>(null);
  const [excluindoParcela, setExcluindoParcela] = useState<ContaFixa | null>(null);

  const itens = lista.data ?? [];
  const visiveis = useMemo(() => {
    const b = normalizar(busca);
    return b ? itens.filter((i) => normalizar(i.descricao).includes(b)) : itens;
  }, [itens, busca]);

  const total = itens.reduce((s, i) => s + paraCentavos(i.valor), 0);
  const pago = itens.filter((i) => i.pago).reduce((s, i) => s + paraCentavos(i.valor), 0);
  const salvar = (id: string, campos: Partial<ContaFixa>) => atualizar.mutate({ id, campos });
  const diaDeHoje = hoje();

  return (
    <>
    <ModalParcelar item={parcelando} tabela="contas_fixas" moeda={prefs.moeda} onFechar={() => setParcelando(null)} />
    <ModalRepetirAteDezembro conta={repetindo} onFechar={() => setRepetindo(null)} />
    <ModalReplicarMes
      aberto={replicando}
      tabela="contas_fixas"
      periodo={periodo}
      itens={itens}
      onFechar={() => setReplicando(false)}
      onIrPara={setPeriodo}
    />
    <ModalExcluirParcela
      item={excluindoParcela}
      onFechar={() => setExcluindoParcela(null)}
      onSoEsta={() => {
        if (excluindoParcela) excluir(excluindoParcela);
        setExcluindoParcela(null);
      }}
      onEstaEProximas={() => {
        const p = excluindoParcela;
        if (p?.grupo_parcela) excluir(p, { grupo: p.grupo_parcela, aPartirDe: p.parcela_num ?? 1 });
        setExcluindoParcela(null);
      }}
    />
    <Quadro
      titulo={t.lanc.contasFixas}
      acaoCabecalho={
        <Button variante="contorno" className="h-10 max-sm:w-full" onClick={() => setReplicando(true)} disabled={itens.length === 0}>
          <Copy size={16} aria-hidden /> {t.replicar.botaoMes}
        </Button>
      }
      busca={busca}
      onBusca={setBusca}
      onAdicionar={() =>
        criar.mutate(
          { vencimento: dataPadrao(periodo), categoria_id: auto(t.lanc.novaConta) },
          { onSuccess: (n) => setNovoId(n.id) },
        )
      }
      adicionando={criar.isPending}
      estado={lista.isPending ? "carregando" : lista.isError ? "erro" : visiveis.length === 0 ? "vazio" : "ok"}
      onTentarDeNovo={() => lista.refetch()}
      colunas={[
        { rotulo: t.lanc.descricao },
        { rotulo: t.lanc.categoria },
        { rotulo: t.lanc.vencimento },
        { rotulo: t.lanc.status },
        { rotulo: t.lanc.valor, alinhar: "direita" },
        { rotulo: "" },
      ]}
      grade={GRADE}
      moeda={prefs.moeda}
      vazio={busca ? t.lanc.nadaEncontrado : t.lanc.vazioContas}
      totais={[
        { rotulo: t.lanc.total, centavos: total },
        { rotulo: t.lanc.pago, centavos: pago, cor: "text-success" },
        { rotulo: t.lanc.pendente, centavos: total - pago, cor: "text-warning" },
      ]}
    >
      {visiveis.map((c) => {
        const atrasada = !c.pago && !!c.vencimento && c.vencimento < diaDeHoje;
        const status = c.pago ? t.lanc.pago : atrasada ? t.lanc.atrasada : t.lanc.pendente;
        return (
          <Linha
            key={c.id}
            grade={GRADE}
            onExcluir={() => (c.grupo_parcela ? setExcluindoParcela(c) : excluir(c))}
            acoes={
              !c.grupo_parcela && (
                <>
                  {c.mes < 12 && (
                    <BotaoAcao rotulo={t.replicar.botaoDezembro} onClick={() => setRepetindo(c)}>
                      <Repeat size={16} />
                    </BotaoAcao>
                  )}
                  <BotaoAcao rotulo={t.parcelas.parcelar} onClick={() => setParcelando(c)}>
                    <Layers size={16} />
                  </BotaoAcao>
                </>
              )
            }
            descricao={
              <div className="flex min-w-0 items-center gap-1">
                <CelulaTexto
                  rotulo={t.lanc.descricao}
                  valor={c.descricao}
                  abrirAoMontar={c.id === novoId}
                  onSalvar={(descricao) => salvar(c.id, { descricao, categoria_id: auto(descricao) })}
                />
                <EtiquetaParcela num={c.parcela_num} total={c.parcela_total} />
              </div>
            }
            extras={
              <>
                <Celula className="w-[10rem] md:w-auto">
                  <SelectCategoria
                    valor={c.categoria_id}
                    categorias={categorias}
                    onSalvar={(categoria_id) => {
                      salvar(c.id, { categoria_id });
                      salvarRegra({ descricao: c.descricao, categoriaId: categoria_id });
                    }}
                  />
                </Celula>
                <Celula className="w-[9.5rem] md:w-auto">
                  <CelulaData rotulo={t.lanc.vencimento} valor={c.vencimento} onSalvar={(vencimento) => salvar(c.id, { vencimento })} />
                </Celula>
                <Celula>
                  <Pill
                    cor={c.pago ? "verde" : atrasada ? "vermelho" : "laranja"}
                    rotulo={`${t.lanc.status}: ${status}. ${t.lanc.cliqueParaTrocar}`}
                    onClick={() => salvar(c.id, { pago: !c.pago })}
                  >
                    {status}
                  </Pill>
                </Celula>
              </>
            }
            valor={
              <CelulaValor
                rotulo={t.lanc.valor}
                moeda={prefs.moeda}
                valor={c.valor}
                classeCor="text-danger"
                onSalvar={(valor) => salvar(c.id, { valor })}
              />
            }
          />
        );
      })}
    </Quadro>
    </>
  );
}
