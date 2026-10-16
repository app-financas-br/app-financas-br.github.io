import { useEffect, useId, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Campo } from "../../components/ui/Campo";
import type { ContaBancaria } from "../contas-bancarias/api";
import { t } from "../../i18n/pt-BR";
import type { Gasto } from "./tipos";

export const MAX_CARTAO = 40;
export const MAX_OBSERVACAO = 500;
const OUTRO = "__outro__";

/** O cartão só faz sentido em débito ou crédito. */
export const usaCartao = (forma: Gasto["forma_pagamento"]) => forma === "debito" || forma === "credito";

export type CamposDetalhes = { cartao: string | null; observacao: string | null; conta_bancaria_id?: string | null };

/** Normaliza o que vai para o banco: texto sem espaços sobrando; vazio = null; cartão só em débito/crédito. */
export function camposDetalhes(gasto: Pick<Gasto, "forma_pagamento">, cartao: string, observacao: string) {
  const limpo = (s: string, max: number) => s.trim().slice(0, max) || null;
  return {
    cartao: usaCartao(gasto.forma_pagamento) ? limpo(cartao, MAX_CARTAO) : null,
    observacao: limpo(observacao, MAX_OBSERVACAO),
  };
}

/**
 * Detalhes do gasto. No crédito, com cartões cadastrados, o cartão vem de uma lista
 * (liga o gasto ao cartão e ao mês da fatura); "Outro" mantém o texto livre de antes.
 */
export function ModalDetalhesGasto({
  gasto,
  cartoes = [],
  onSalvar,
  onFechar,
}: {
  gasto: Gasto | null;
  cartoes?: ContaBancaria[];
  onSalvar: (campos: CamposDetalhes) => void;
  onFechar: () => void;
}) {
  const idObs = useId();
  const idCartao = useId();
  const [cartao, setCartao] = useState("");
  const [cartaoId, setCartaoId] = useState(OUTRO);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    setCartao(gasto?.cartao ?? "");
    setObservacao(gasto?.observacao ?? "");
    setCartaoId(cartoes.some((c) => c.id === gasto?.conta_bancaria_id) ? gasto!.conta_bancaria_id! : cartoes.length > 0 ? cartoes[0]!.id : OUTRO);
  }, [gasto]); // recarrega só quando abre outro gasto

  if (!gasto) return null;
  const comCartao = usaCartao(gasto.forma_pagamento);
  const lista = gasto.forma_pagamento === "credito" && cartoes.length > 0;

  const salvar = () => {
    if (lista && cartaoId !== OUTRO) {
      const c = cartoes.find((x) => x.id === cartaoId)!;
      onSalvar({ ...camposDetalhes(gasto, c.nome, observacao), conta_bancaria_id: c.id });
    } else {
      const campos: CamposDetalhes = camposDetalhes(gasto, cartao, observacao);
      // Saiu de um cartão da lista para "Outro": desliga o gasto do cartão
      if (lista && cartoes.some((c) => c.id === gasto.conta_bancaria_id)) campos.conta_bancaria_id = null;
      onSalvar(campos);
    }
    onFechar();
  };

  return (
    <Modal
      aberto
      titulo={t.detalhes.titulo(gasto.descricao)}
      onFechar={onFechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={onFechar}>
            {t.parcelas.cancelar}
          </Button>
          <Button onClick={salvar}>{t.detalhes.salvar}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {lista && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={idCartao} className="text-[length:var(--fs-sm)] font-medium text-muted">
              {t.detalhes.cartaoCredito}
            </label>
            <select
              id={idCartao}
              value={cartaoId}
              onChange={(e) => setCartaoId(e.target.value)}
              className="h-11 w-full cursor-pointer rounded-md border border-border bg-input px-3 text-text focus:border-border-glow [&>option]:bg-elevated"
            >
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
              <option value={OUTRO}>{t.detalhes.outroCartao}</option>
            </select>
          </div>
        )}
        {comCartao && (!lista || cartaoId === OUTRO) ? (
          <Campo
            rotulo={t.detalhes.cartao}
            placeholder={t.detalhes.cartaoExemplo}
            maxLength={MAX_CARTAO}
            value={cartao}
            onChange={(e) => setCartao(e.target.value)}
          />
        ) : !comCartao ? (
          <p className="text-[length:var(--fs-sm)] text-muted">{t.detalhes.semCartao(t.lanc.formas[gasto.forma_pagamento])}</p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idObs} className="text-[length:var(--fs-sm)] font-medium text-muted">
            {t.detalhes.observacao}
          </label>
          <textarea
            id={idObs}
            rows={4}
            maxLength={MAX_OBSERVACAO}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full resize-y rounded-md border border-border bg-input px-3 py-2 text-text placeholder:text-faint focus:border-border-glow"
          />
          <span className="num self-end text-[length:var(--fs-xs)] text-faint">
            {observacao.length}/{MAX_OBSERVACAO}
          </span>
        </div>
      </div>
    </Modal>
  );
}
