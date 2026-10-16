import { useMemo, useState } from "react";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { usePreferencias } from "../preferencias/usePreferencias";
import { paraCentavos } from "../../lib/dinheiro";
import { dataPadrao } from "../../lib/datas";
import { normalizar } from "../../lib/categorizar";
import { useAtualizarLancamento, useCriarLancamento, useExcluirComDesfazer, useLancamentos } from "./api";
import { CelulaData, CelulaTexto, CelulaValor, Pill } from "./celulas";
import { Copy } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Celula, Linha, Quadro } from "./Quadro";
import { ModalReplicarMes } from "./replicar";
import type { Entrada } from "./tipos";
import { t } from "../../i18n/pt-BR";

const GRADE = "minmax(0,1fr) 9.5rem 7.5rem 4.5rem 8.5rem 2.5rem";

export function Entradas() {
  const { ano, mes, setPeriodo } = usePeriodo();
  const periodo = { ano, mes };
  const [replicando, setReplicando] = useState(false);
  const { prefs } = usePreferencias();
  const lista = useLancamentos<Entrada>("entradas", periodo);
  const criar = useCriarLancamento<Entrada>("entradas", periodo);
  const atualizar = useAtualizarLancamento<Entrada>("entradas", periodo);
  const excluir = useExcluirComDesfazer<Entrada>("entradas", periodo);
  const [busca, setBusca] = useState("");
  const [novoId, setNovoId] = useState<string | null>(null);

  const itens = lista.data ?? [];
  const visiveis = useMemo(() => {
    const b = normalizar(busca);
    return b ? itens.filter((i) => normalizar(i.descricao).includes(b)) : itens;
  }, [itens, busca]);

  const total = itens.reduce((s, i) => s + paraCentavos(i.valor), 0);
  const recebido = itens.filter((i) => i.recebido).reduce((s, i) => s + paraCentavos(i.valor), 0);
  const salvar = (id: string, campos: Partial<Entrada>) => atualizar.mutate({ id, campos });

  return (
    <>
    <ModalReplicarMes
      aberto={replicando}
      tabela="entradas"
      periodo={periodo}
      itens={itens}
      onFechar={() => setReplicando(false)}
      onIrPara={setPeriodo}
    />
    <Quadro
      titulo={t.lanc.entradas}
      acaoCabecalho={
        <Button variante="contorno" className="h-10 max-sm:w-full" onClick={() => setReplicando(true)} disabled={itens.length === 0}>
          <Copy size={16} aria-hidden /> {t.replicar.botaoMes}
        </Button>
      }
      busca={busca}
      onBusca={setBusca}
      onAdicionar={() => criar.mutate({ data: dataPadrao(periodo) }, { onSuccess: (n) => setNovoId(n.id) })}
      adicionando={criar.isPending}
      estado={lista.isPending ? "carregando" : lista.isError ? "erro" : visiveis.length === 0 ? "vazio" : "ok"}
      onTentarDeNovo={() => lista.refetch()}
      colunas={[
        { rotulo: t.lanc.descricao },
        { rotulo: t.lanc.data },
        { rotulo: t.lanc.status },
        { rotulo: t.lanc.pctTotal, alinhar: "direita" },
        { rotulo: t.lanc.valor, alinhar: "direita" },
        { rotulo: "" },
      ]}
      grade={GRADE}
      moeda={prefs.moeda}
      vazio={busca ? t.lanc.nadaEncontrado : t.lanc.vazioEntradas}
      totais={[
        { rotulo: t.lanc.total, centavos: total },
        { rotulo: t.lanc.recebido, centavos: recebido, cor: "text-success" },
        { rotulo: t.lanc.aReceber, centavos: total - recebido, cor: "text-warning" },
      ]}
    >
      {visiveis.map((e) => {
        const pct = total > 0 ? (paraCentavos(e.valor) / total) * 100 : 0;
        return (
          <Linha
            key={e.id}
            grade={GRADE}
            onExcluir={() => excluir(e)}
            descricao={
              <CelulaTexto
                rotulo={t.lanc.descricao}
                valor={e.descricao}
                abrirAoMontar={e.id === novoId}
                onSalvar={(descricao) => salvar(e.id, { descricao })}
              />
            }
            extras={
              <>
                <Celula className="w-[9.5rem] md:w-auto">
                  <CelulaData rotulo={t.lanc.data} valor={e.data} onSalvar={(data) => salvar(e.id, { data })} />
                </Celula>
                <Celula>
                  <Pill
                    cor={e.recebido ? "verde" : "laranja"}
                    rotulo={`${t.lanc.status}: ${e.recebido ? t.lanc.recebido : t.lanc.aReceber}. ${t.lanc.cliqueParaTrocar}`}
                    onClick={() => salvar(e.id, { recebido: !e.recebido })}
                  >
                    {e.recebido ? t.lanc.recebido : t.lanc.aReceber}
                  </Pill>
                </Celula>
                <Celula className="num text-right text-[length:var(--fs-sm)] text-muted max-md:hidden">
                  {pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </Celula>
              </>
            }
            valor={
              <CelulaValor
                rotulo={t.lanc.valor}
                moeda={prefs.moeda}
                valor={e.valor}
                classeCor="text-success"
                onSalvar={(valor) => salvar(e.id, { valor })}
              />
            }
          />
        );
      })}
    </Quadro>
    </>
  );
}
