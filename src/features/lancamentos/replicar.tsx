import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";
import { proximoMes, type Periodo } from "../../lib/datas";
import { t } from "../../i18n/pt-BR";
import type { ContaFixa, Entrada } from "./tipos";
import {
  linhasReplicarMes,
  linhasRepetir,
  mesesAteDezembro,
  mesesComMesmaConta,
  type Linha,
  type TabelaReplicavel,
} from "./regrasReplicar";

const nomePeriodo = ({ ano, mes }: Periodo) => `${t.meses[mes - 1]}/${ano}`;

/** Insere várias linhas num único insert (tudo ou nada) e recarrega a tabela em todos os meses. */
function useInserirLote(tabela: TabelaReplicavel, rotuloLog: string) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationKey: ["salvar", tabela],
    mutationFn: async (linhas: Linha[]) => {
      const { error } = await supabase.from(tabela).insert(linhas);
      if (error) throw error;
    },
    onError: (erro) => {
      console.error(`[replicar] ${rotuloLog}`, erro);
      mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [tabela] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Replicar mês (Entradas e Contas fixas → mês seguinte)
// ---------------------------------------------------------------------------

export function ModalReplicarMes({
  aberto,
  tabela,
  periodo,
  itens,
  onFechar,
  onIrPara,
}: {
  aberto: boolean;
  tabela: TabelaReplicavel;
  periodo: Periodo;
  itens: (Entrada | ContaFixa)[];
  onFechar: () => void;
  /** Navega para o mês de destino depois de copiar. */
  onIrPara: (p: Periodo) => void;
}) {
  const { mostrar } = useToast();
  const destino = proximoMes(periodo);
  const linhas = linhasReplicarMes(tabela, itens, destino);
  const ignoradas = itens.length - linhas.length;
  const inserir = useInserirLote(tabela, "mes");

  // Quantos itens o mês de destino já tem (para avisar sobre duplicar)
  const noDestino = useQuery({
    queryKey: [tabela, destino.ano, destino.mes, "contagem"],
    enabled: aberto,
    queryFn: async () => {
      const { count, error } = await supabase
        .from(tabela)
        .select("id", { count: "exact", head: true })
        .eq("ano", destino.ano)
        .eq("mes", destino.mes);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const confirmar = () =>
    inserir.mutate(linhas, {
      onSuccess: () => {
        mostrar({ tipo: "info", texto: t.replicar.feito(linhas.length, nomePeriodo(destino)) });
        onFechar();
        onIrPara(destino);
      },
    });

  return (
    <Modal
      aberto={aberto}
      titulo={t.replicar.tituloMes(nomePeriodo(destino))}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>
            {t.parcelas.cancelar}
          </Button>
          <Button disabled={linhas.length === 0 || inserir.isPending} onClick={confirmar}>
            {inserir.isPending ? t.auth.salvando : t.replicar.confirmar(linhas.length)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-muted">
        {linhas.length === 0 ? (
          <p>{t.replicar.nada}</p>
        ) : (
          <p>{tabela === "contas_fixas" ? t.replicar.explicacaoContas(linhas.length) : t.replicar.explicacaoEntradas(linhas.length)}</p>
        )}
        {ignoradas > 0 && <p className="text-[length:var(--fs-sm)]">{t.replicar.ignoradas(ignoradas)}</p>}
        {(noDestino.data ?? 0) > 0 && <Aviso tipo="erro">{t.replicar.destinoTem(noDestino.data!, nomePeriodo(destino))}</Aviso>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Repetir até dezembro (uma conta fixa → meses restantes do ano)
// ---------------------------------------------------------------------------

export function ModalRepetirAteDezembro({ conta, onFechar }: { conta: ContaFixa | null; onFechar: () => void }) {
  const { mostrar } = useToast();
  const inserir = useInserirLote("contas_fixas", "ate dezembro");
  const meses = conta ? mesesAteDezembro(conta) : [];

  // Contas já existentes nos meses seguintes do mesmo ano (para achar duplicatas pela descrição)
  const existentes = useQuery({
    queryKey: ["contas_fixas", conta?.ano, "depois-de", conta?.mes],
    enabled: conta !== null && meses.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_fixas")
        .select("ano, mes, descricao")
        .eq("ano", conta!.ano)
        .gt("mes", conta!.mes);
      if (error) throw error;
      return data as { ano: number; mes: number; descricao: string }[];
    },
  });

  const duplicados = conta && existentes.data ? mesesComMesmaConta(conta.descricao, meses, existentes.data) : [];
  const livres = meses.filter((m) => !duplicados.some((d) => d.ano === m.ano && d.mes === m.mes));
  const nomes = (lista: Periodo[]) => lista.map((p) => t.mesesCurtos[p.mes - 1]).join(", ");

  const criar = (alvo: Periodo[]) =>
    conta &&
    inserir.mutate(linhasRepetir(conta, alvo), {
      onSuccess: () => {
        mostrar({ tipo: "info", texto: t.replicar.repetido(alvo.length) });
        onFechar();
      },
    });

  const ocupado = inserir.isPending || existentes.isPending;

  return (
    <Modal
      aberto={conta !== null}
      titulo={t.replicar.tituloDezembro}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>
            {t.parcelas.cancelar}
          </Button>
          {duplicados.length > 0 ? (
            <>
              <Button variante="contorno" disabled={ocupado} onClick={() => criar(meses)}>
                {t.replicar.criarMesmoAssim(meses.length)}
              </Button>
              <Button disabled={ocupado || livres.length === 0} onClick={() => criar(livres)}>
                {t.replicar.pularDuplicados(livres.length)}
              </Button>
            </>
          ) : (
            <Button disabled={ocupado || meses.length === 0} onClick={() => criar(meses)}>
              {inserir.isPending ? t.auth.salvando : t.replicar.confirmar(meses.length)}
            </Button>
          )}
        </>
      }
    >
      {conta && (
        <div className="flex flex-col gap-3 text-muted">
          <p>{meses.length === 0 ? t.replicar.jaDezembro : t.replicar.explicacaoDezembro(conta.descricao, nomes(meses))}</p>
          {existentes.isError && <Aviso tipo="erro">{t.replicar.erroConferir}</Aviso>}
          {duplicados.length > 0 && (
            <Aviso tipo="erro">{t.replicar.mesesJaTem(conta.descricao, nomes(duplicados))}</Aviso>
          )}
        </div>
      )}
    </Modal>
  );
}
