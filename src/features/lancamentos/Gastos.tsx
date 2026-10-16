import { useMemo, useState } from "react";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { usePreferencias } from "../preferencias/usePreferencias";
import { paraCentavos } from "../../lib/dinheiro";
import { dataPadrao, hoje as hojeLocal, parseData } from "../../lib/datas";
import { faturaDaCompra, regraDoCartao } from "../../lib/fatura";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/Toast";
import { useContasBancarias } from "../contas-bancarias/api";
import { normalizar } from "../../lib/categorizar";
import { useAtualizarLancamento, useCriarLancamento, useExcluirComDesfazer, useLancamentos } from "./api";
import { CelulaData, CelulaTexto, CelulaValor, Pill, SelectCategoria } from "./celulas";
import { Layers, NotebookPen } from "lucide-react";
import { ModalDetalhesGasto, usaCartao } from "./DetalhesGasto";
import { BotaoAcao, Celula, Linha, Quadro } from "./Quadro";
import { EtiquetaParcela } from "./ContasFixas";
import { ModalExcluirParcela, ModalParcelar } from "./parcelas";
import { useCategoriasGasto } from "./useCategoriasGasto";
import { FORMAS, type Gasto } from "./tipos";
import { t } from "../../i18n/pt-BR";

const GRADE = "minmax(0,1fr) 9rem 9.5rem 6.5rem 6.5rem 8.5rem 7.5rem";

export function Gastos() {
  const { ano, mes, setPeriodo } = usePeriodo();
  const periodo = { ano, mes };
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const { data: contas = [] } = useContasBancarias();
  const cartoes = contas.filter((c) => c.ativa && c.tipo === "cartao_credito");
  const { prefs } = usePreferencias();
  const { categorias, auto, salvarRegra } = useCategoriasGasto();
  const lista = useLancamentos<Gasto>("gastos_variaveis", periodo);
  const criar = useCriarLancamento<Gasto>("gastos_variaveis", periodo);
  const atualizar = useAtualizarLancamento<Gasto>("gastos_variaveis", periodo);
  const excluir = useExcluirComDesfazer<Gasto>("gastos_variaveis", periodo);
  const [busca, setBusca] = useState("");
  const [novoId, setNovoId] = useState<string | null>(null);
  const [parcelando, setParcelando] = useState<Gasto | null>(null);
  const [excluindoParcela, setExcluindoParcela] = useState<Gasto | null>(null);
  const [detalhando, setDetalhando] = useState<Gasto | null>(null);

  const itens = lista.data ?? [];
  const visiveis = useMemo(() => {
    const b = normalizar(busca);
    return b ? itens.filter((i) => normalizar(i.descricao).includes(b)) : itens;
  }, [itens, busca]);

  const total = itens.reduce((s, i) => s + paraCentavos(i.valor), 0);
  const pago = itens.filter((i) => i.pago).reduce((s, i) => s + paraCentavos(i.valor), 0);
  const salvar = (id: string, campos: Partial<Gasto>) => atualizar.mutate({ id, campos });

  /**
   * Gasto no cartão de crédito conta no mês da FATURA (docs/08-cartao.md). Ao ligar o cartão
   * ou mudar a data, recalcula; se for outro mês, o gasto muda para lá e o toast avisa.
   */
  const salvarComFatura = (g: Gasto, campos: Partial<Gasto>) => {
    const forma = campos.forma_pagamento ?? g.forma_pagamento;
    const cartao = cartoes.find((c) => c.id === (campos.conta_bancaria_id !== undefined ? campos.conta_bancaria_id : g.conta_bancaria_id));
    const regra = forma === "credito" && cartao ? regraDoCartao(cartao) : null;
    const data = campos.data ?? g.data ?? hojeLocal();
    const f = regra ? faturaDaCompra(data, regra) : null;
    if (!f || (f.ano === g.ano && f.mes === g.mes)) return salvar(g.id, campos);
    atualizar.mutate(
      { id: g.id, campos: { ...campos, ano: f.ano, mes: f.mes } },
      {
        onSuccess: () => {
          // O mês de destino pode estar em cache sem o gasto: descarta para buscar de novo ao abrir
          qc.removeQueries({ queryKey: ["gastos_variaveis", f.ano, f.mes], exact: true });
          qc.invalidateQueries({ queryKey: ["gastos_variaveis"] });
          mostrar({
            tipo: "info",
            texto: t.lanc.movidoFatura(parseData(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), cartao!.nome, `${t.meses[f.mes - 1]!.toLowerCase()} de ${f.ano}`),
            acao: { rotulo: t.lanc.ver, onClick: () => setPeriodo({ ano: f.ano, mes: f.mes }) },
          });
        },
      },
    );
  };

  return (
    <>
    <ModalParcelar item={parcelando} tabela="gastos_variaveis" moeda={prefs.moeda} onFechar={() => setParcelando(null)} />
    <ModalDetalhesGasto
      gasto={detalhando}
      onFechar={() => setDetalhando(null)}
      cartoes={cartoes}
      onSalvar={(campos) => detalhando && salvarComFatura(detalhando, campos)}
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
      titulo={t.lanc.gastos}
      busca={busca}
      onBusca={setBusca}
      onAdicionar={() =>
        criar.mutate(
          { data: dataPadrao(periodo), categoria_id: auto(t.lanc.novoGasto) },
          { onSuccess: (n) => setNovoId(n.id) },
        )
      }
      adicionando={criar.isPending}
      estado={lista.isPending ? "carregando" : lista.isError ? "erro" : visiveis.length === 0 ? "vazio" : "ok"}
      onTentarDeNovo={() => lista.refetch()}
      colunas={[
        { rotulo: t.lanc.descricao },
        { rotulo: t.lanc.categoria },
        { rotulo: t.lanc.data },
        { rotulo: t.lanc.pagamento },
        { rotulo: t.lanc.status },
        { rotulo: t.lanc.valor, alinhar: "direita" },
        { rotulo: "" },
      ]}
      grade={GRADE}
      moeda={prefs.moeda}
      vazio={busca ? t.lanc.nadaEncontrado : t.lanc.vazioGastos}
      totais={[
        { rotulo: t.lanc.total, centavos: total },
        { rotulo: t.lanc.pago, centavos: pago, cor: "text-success" },
        { rotulo: t.lanc.pendente, centavos: total - pago, cor: "text-warning" },
      ]}
    >
      {visiveis.map((g) => {
        const proxima = FORMAS[(FORMAS.indexOf(g.forma_pagamento) + 1) % FORMAS.length]!;
        return (
          <Linha
            key={g.id}
            grade={GRADE}
            onExcluir={() => (g.grupo_parcela ? setExcluindoParcela(g) : excluir(g))}
            acoes={
              <>
                <BotaoAcao rotulo={g.observacao ? t.detalhes.botaoComObs : t.detalhes.botao} onClick={() => setDetalhando(g)}>
                  <NotebookPen size={16} className={g.observacao ? "text-primary-text" : ""} />
                </BotaoAcao>
                {!g.grupo_parcela && (
                  <BotaoAcao rotulo={t.parcelas.parcelar} onClick={() => setParcelando(g)}>
                    <Layers size={16} />
                  </BotaoAcao>
                )}
              </>
            }
            descricao={
              <div className="flex min-w-0 items-center gap-1">
                <CelulaTexto
                  rotulo={t.lanc.descricao}
                  valor={g.descricao}
                  abrirAoMontar={g.id === novoId}
                  onSalvar={(descricao) => salvar(g.id, { descricao, categoria_id: auto(descricao) })}
                />
                <EtiquetaParcela num={g.parcela_num} total={g.parcela_total} />
              </div>
            }
            extras={
              <>
                <Celula className="w-[9rem] md:w-auto">
                  <SelectCategoria
                    valor={g.categoria_id}
                    categorias={categorias}
                    onSalvar={(categoria_id) => {
                      salvar(g.id, { categoria_id });
                      salvarRegra({ descricao: g.descricao, categoriaId: categoria_id });
                    }}
                  />
                </Celula>
                <Celula className="w-[9.5rem] md:w-auto">
                  <CelulaData rotulo={t.lanc.data} valor={g.data} onSalvar={(data) => salvarComFatura(g, { data })} />
                </Celula>
                <Celula className="flex flex-col items-start gap-0.5">
                  <Pill
                    cor="neutra"
                    rotulo={`${t.lanc.pagamento}: ${t.lanc.formas[g.forma_pagamento]}. ${t.lanc.cliqueParaTrocar}`}
                    onClick={() => {
                      // Saindo do crédito, desliga o cartão; entrando no crédito com cartões cadastrados, pede o cartão
                      const saiDoCartao = g.forma_pagamento === "credito" && cartoes.some((c) => c.id === g.conta_bancaria_id);
                      salvar(g.id, saiDoCartao ? { forma_pagamento: proxima, conta_bancaria_id: null } : { forma_pagamento: proxima });
                      if (proxima === "credito" && cartoes.length > 0) setDetalhando({ ...g, forma_pagamento: proxima });
                    }}
                  >
                    {t.lanc.formas[g.forma_pagamento]}
                  </Pill>
                  {g.cartao && usaCartao(g.forma_pagamento) && (
                    <span className="max-w-full truncate px-1 text-[length:var(--fs-xs)] text-muted" title={g.cartao}>
                      {g.cartao}
                    </span>
                  )}
                </Celula>
                <Celula>
                  <Pill
                    cor={g.pago ? "verde" : "laranja"}
                    rotulo={`${t.lanc.status}: ${g.pago ? t.lanc.pago : t.lanc.pendente}. ${t.lanc.cliqueParaTrocar}`}
                    onClick={() => salvar(g.id, { pago: !g.pago })}
                  >
                    {g.pago ? t.lanc.pago : t.lanc.pendente}
                  </Pill>
                </Celula>
              </>
            }
            valor={
              <CelulaValor
                rotulo={t.lanc.valor}
                moeda={prefs.moeda}
                valor={g.valor}
                classeCor="text-danger"
                onSalvar={(valor) => salvar(g.id, { valor })}
              />
            }
          />
        );
      })}
    </Quadro>
    </>
  );
}
