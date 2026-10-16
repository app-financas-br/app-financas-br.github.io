import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";
import { datasParcelas, dividirParcelas, periodosParcelas } from "../../lib/calculos";
import { formatarMoeda, paraCentavos, type Moeda } from "../../lib/dinheiro";
import { hoje, parseData, type Periodo } from "../../lib/datas";
import { faturasDasParcelas, regraDoCartao, sugerirFatura } from "../../lib/fatura";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import type { ContaBancaria } from "../contas-bancarias/api";
import { invalidarDerivados } from "./api";
import { diaMes, EscolhaFatura, nomeFatura } from "./EscolhaFatura";
import { t } from "../../i18n/pt-BR";
import type { ContaFixa, Gasto } from "./tipos";

type Parcelavel = ContaFixa | Gasto;
type TabelaParcelavel = "contas_fixas" | "gastos_variaveis";
const ehCredito = (item: Parcelavel): item is Gasto => "forma_pagamento" in item && item.forma_pagamento === "credito";

const dataDoItem = (item: Parcelavel) => ("vencimento" in item ? item.vencimento : item.data);

/**
 * Chama a RPC transacional parcelar_lancamento (tudo ou nada) e recarrega todos os meses da tabela.
 * `primeira` (só gastos): mês da fatura da 1ª parcela; se não for o mês aberto, o toast oferece "Ver".
 */
export function useParcelar(tabela: TabelaParcelavel) {
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const { ano, mes, setPeriodo } = usePeriodo();
  return useMutation({
    mutationKey: ["salvar", tabela],
    mutationFn: async ({ id, parcelas, primeira }: { id: string; parcelas: number; primeira?: Periodo }) => {
      const { error } = await supabase.rpc("parcelar_lancamento", {
        p_tabela: tabela,
        p_id: id,
        p_parcelas: parcelas,
        ...(primeira ? { p_ano: primeira.ano, p_mes: primeira.mes } : {}),
      });
      if (error) throw error;
    },
    onSuccess: (_d, { parcelas, primeira }) => {
      const mudou = primeira && (primeira.ano !== ano || primeira.mes !== mes);
      mostrar({
        tipo: "info",
        texto: mudou ? `${t.parcelas.feito(parcelas)} ${t.parcelas.primeiraEm(nomeFatura(primeira))}` : t.parcelas.feito(parcelas),
        ...(mudou ? { acao: { rotulo: t.lanc.ver, onClick: () => setPeriodo(primeira) } } : {}),
      });
    },
    onError: (erro) => {
      console.error("[parcelas] parcelar", erro);
      // Erros de regra (22023) vêm do banco já em português
      const e = erro as { code?: string; message?: string };
      mostrar({ tipo: "erro", texto: e.code === "22023" && e.message ? e.message : t.lanc.erroSalvar });
    },
    onSettled: () => {
      // Meses fora da tela podem estar em cache sem as parcelas novas: descarta para buscar ao abrir
      qc.removeQueries({ queryKey: [tabela], type: "inactive" });
      qc.invalidateQueries({ queryKey: [tabela] });
      invalidarDerivados(qc);
    },
  });
}

/**
 * Modal com a escolha de 2 a 12 parcelas e a prévia de cada uma (mês, data, valor).
 * No crédito: escolha do mês da fatura da 1ª parcela e "Compra 16/10 → conta em <mês>" por parcela.
 */
export function ModalParcelar({
  item,
  tabela,
  moeda,
  cartoes = [],
  onFechar,
}: {
  item: Parcelavel | null;
  tabela: TabelaParcelavel;
  moeda: Moeda;
  cartoes?: ContaBancaria[];
  onFechar: () => void;
}) {
  const [n, setN] = useState(2);
  /** Mês da 1ª parcela escolhido; null = a fatura em que o gasto já está (escolhida ao lançar). */
  const [escolhida, setEscolhida] = useState<Periodo | null>(null);
  const parcelar = useParcelar(tabela);
  const credito = item !== null && ehCredito(item);
  const dataCompra = (item && dataDoItem(item)) ?? hoje();
  const cartao = credito ? cartoes.find((c) => c.id === item.conta_bancaria_id) : undefined;
  const regra = cartao ? regraDoCartao(cartao) : null;

  const primeira = escolhida ?? { ano: item?.ano ?? 0, mes: item?.mes ?? 0 };
  useEffect(() => setEscolhida(null), [item]);

  const previa = useMemo(() => {
    if (!item) return [];
    const valores = dividirParcelas(paraCentavos(item.valor), n);
    const data = dataDoItem(item);
    const datas = data ? datasParcelas(data, n) : null;
    if (credito) {
      // A compra foi num dia só: todas as parcelas mostram a data real e o mês em que contam
      return faturasDasParcelas(primeira, n).map((p, i) => ({
        num: i + 1,
        mes: t.fatura.compraConta(diaMes(dataCompra), nomeFatura(p)),
        data: null,
        centavos: valores[i]!,
      }));
    }
    return periodosParcelas({ ano: item.ano, mes: item.mes }, n).map((p, i) => ({
      num: i + 1,
      mes: `${t.mesesCurtos[p.mes - 1]}/${p.ano}`,
      data: datas ? parseData(datas[i]!).toLocaleDateString("pt-BR") : null,
      centavos: valores[i]!,
    }));
  }, [item, n, credito, primeira, dataCompra]);

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
            onClick={() => item && parcelar.mutate({ id: item.id, parcelas: n, ...(credito ? { primeira } : {}) }, { onSuccess: fechar })}
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
          {credito && (
            <EscolhaFatura
              dataCompra={dataCompra}
              valor={primeira}
              sugestao={sugerirFatura(dataCompra, regra)}
              aviso={regra && cartao ? t.fatura.sugestaoCartao(cartao.nome, nomeFatura(sugerirFatura(dataCompra, regra))) : t.fatura.semRegra}
              mostrarResumo={false}
              onMudar={setEscolhida}
            />
          )}
          <ol className="max-h-60 overflow-y-auto rounded-md border border-border">
            {previa.map((p) => (
              <li key={p.num} className="num flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
                <span className="w-9 shrink-0 text-muted">{p.num}/{n}</span>
                <span className={`min-w-0 flex-1 text-text ${credito ? "text-[length:var(--fs-sm)] leading-snug" : ""}`}>{p.mes}{p.data && <span className="ml-2 text-muted">{p.data}</span>}</span>
                <span className="shrink-0 font-medium text-text">{formatarMoeda(p.centavos, moeda)}</span>
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
