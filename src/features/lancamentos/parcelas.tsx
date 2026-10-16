import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";
import { datasParcelas, dividirParcelas, periodosParcelas } from "../../lib/calculos";
import { formatarMoeda, paraCentavos, type Moeda } from "../../lib/dinheiro";
import { parseData } from "../../lib/datas";
import { t } from "../../i18n/pt-BR";
import type { ContaFixa, Gasto } from "./tipos";

type Parcelavel = ContaFixa | Gasto;
type TabelaParcelavel = "contas_fixas" | "gastos_variaveis";

const dataDoItem = (item: Parcelavel) => ("vencimento" in item ? item.vencimento : item.data);

/** Chama a RPC transacional parcelar_lancamento (tudo ou nada) e recarrega todos os meses da tabela. */
export function useParcelar(tabela: TabelaParcelavel) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  return useMutation({
    mutationKey: ["salvar", tabela],
    mutationFn: async ({ id, parcelas }: { id: string; parcelas: number }) => {
      const { error } = await supabase.rpc("parcelar_lancamento", { p_tabela: tabela, p_id: id, p_parcelas: parcelas });
      if (error) throw error;
    },
    onSuccess: (_d, { parcelas }) => mostrar({ tipo: "info", texto: t.parcelas.feito(parcelas) }),
    onError: (erro) => {
      console.error("[parcelas] parcelar", erro);
      // Erros de regra (22023) vêm do banco já em português
      const e = erro as { code?: string; message?: string };
      mostrar({ tipo: "erro", texto: e.code === "22023" && e.message ? e.message : t.lanc.erroSalvar });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [tabela] });
      qc.invalidateQueries({ queryKey: ["resumo"] });
    },
  });
}

/** Modal com a escolha de 2 a 12 parcelas e a prévia de cada uma (mês, data, valor). */
export function ModalParcelar({
  item,
  tabela,
  moeda,
  onFechar,
}: {
  item: Parcelavel | null;
  tabela: TabelaParcelavel;
  moeda: Moeda;
  onFechar: () => void;
}) {
  const [n, setN] = useState(2);
  const parcelar = useParcelar(tabela);

  const previa = useMemo(() => {
    if (!item) return [];
    const valores = dividirParcelas(paraCentavos(item.valor), n);
    const data = dataDoItem(item);
    const datas = data ? datasParcelas(data, n) : null;
    return periodosParcelas({ ano: item.ano, mes: item.mes }, n).map((p, i) => ({
      num: i + 1,
      mes: `${t.mesesCurtos[p.mes - 1]}/${p.ano}`,
      data: datas ? parseData(datas[i]!).toLocaleDateString("pt-BR") : null,
      centavos: valores[i]!,
    }));
  }, [item, n]);

  const fechar = () => {
    setN(2);
    onFechar();
  };

  return (
    <Modal
      aberto={item !== null}
      titulo={t.parcelas.titulo}
      onFechar={fechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={fechar}>
            {t.parcelas.cancelar}
          </Button>
          <Button
            disabled={parcelar.isPending || paraCentavos(item?.valor) === 0}
            onClick={() => item && parcelar.mutate({ id: item.id, parcelas: n }, { onSuccess: fechar })}
          >
            {parcelar.isPending ? t.auth.salvando : t.parcelas.confirmar(n)}
          </Button>
        </>
      }
    >
      {item && (
        <div className="flex flex-col gap-4">
          <p className="text-muted">
            {t.parcelas.explicacao(item.descricao, formatarMoeda(paraCentavos(item.valor), moeda))}
          </p>
          {paraCentavos(item.valor) === 0 && <Aviso tipo="erro">{t.parcelas.valorZero}</Aviso>}
          <label className="flex items-center justify-between gap-3">
            <span className="text-text">{t.parcelas.quantas}</span>
            <select
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="h-10 rounded-md border border-border bg-input px-3 text-text [&>option]:bg-elevated"
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((v) => (
                <option key={v} value={v}>
                  {v}x
                </option>
              ))}
            </select>
          </label>
          <ol className="max-h-60 overflow-y-auto rounded-md border border-border">
            {previa.map((p) => (
              <li key={p.num} className="num flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                <span className="w-10 text-muted">{p.num}/{n}</span>
                <span className="flex-1 text-text">{p.mes}{p.data && <span className="ml-2 text-muted">{p.data}</span>}</span>
                <span className="font-medium text-text">{formatarMoeda(p.centavos, moeda)}</span>
              </li>
            ))}
          </ol>
          <p className="text-[length:var(--fs-sm)] text-faint">{t.parcelas.aviso}</p>
        </div>
      )}
    </Modal>
  );
}

/** Pergunta "só esta" ou "esta e as próximas" ao excluir uma parcela. */
export function ModalExcluirParcela({
  item,
  onSoEsta,
  onEstaEProximas,
  onFechar,
}: {
  item: Parcelavel | null;
  onSoEsta: () => void;
  onEstaEProximas: () => void;
  onFechar: () => void;
}) {
  return (
    <Modal
      aberto={item !== null}
      titulo={t.parcelas.excluirTitulo}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>
            {t.parcelas.cancelar}
          </Button>
          <Button variante="contorno" onClick={onSoEsta}>
            {t.parcelas.soEsta}
          </Button>
          <Button onClick={onEstaEProximas} className="!bg-danger !text-text hover:opacity-90">
            {t.parcelas.estaEProximas}
          </Button>
        </>
      }
    >
      {item && (
        <p className="text-muted">
          {t.parcelas.excluirTexto(item.descricao, item.parcela_num ?? 1, item.parcela_total ?? 1)}
        </p>
      )}
    </Modal>
  );
}
