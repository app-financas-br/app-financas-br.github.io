import { useEffect, useId, useState } from "react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Campo } from "../../components/ui/Campo";
import { t } from "../../i18n/pt-BR";
import type { Gasto } from "./tipos";

export const MAX_CARTAO = 40;
export const MAX_OBSERVACAO = 500;

/** O cartão só faz sentido em débito ou crédito. */
export const usaCartao = (forma: Gasto["forma_pagamento"]) => forma === "debito" || forma === "credito";

/** Normaliza o que vai para o banco: texto sem espaços sobrando; vazio = null; cartão só em débito/crédito. */
export function camposDetalhes(gasto: Pick<Gasto, "forma_pagamento">, cartao: string, observacao: string) {
  const limpo = (s: string, max: number) => s.trim().slice(0, max) || null;
  return {
    cartao: usaCartao(gasto.forma_pagamento) ? limpo(cartao, MAX_CARTAO) : null,
    observacao: limpo(observacao, MAX_OBSERVACAO),
  };
}

export function ModalDetalhesGasto({
  gasto,
  onSalvar,
  onFechar,
}: {
  gasto: Gasto | null;
  onSalvar: (campos: { cartao: string | null; observacao: string | null }) => void;
  onFechar: () => void;
}) {
  const idObs = useId();
  const [cartao, setCartao] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    setCartao(gasto?.cartao ?? "");
    setObservacao(gasto?.observacao ?? "");
  }, [gasto]);

  if (!gasto) return null;
  const comCartao = usaCartao(gasto.forma_pagamento);

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
          <Button
            onClick={() => {
              onSalvar(camposDetalhes(gasto, cartao, observacao));
              onFechar();
            }}
          >
            {t.detalhes.salvar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {comCartao ? (
          <Campo
            rotulo={t.detalhes.cartao}
            placeholder={t.detalhes.cartaoExemplo}
            maxLength={MAX_CARTAO}
            value={cartao}
            onChange={(e) => setCartao(e.target.value)}
          />
        ) : (
          <p className="text-[length:var(--fs-sm)] text-muted">{t.detalhes.semCartao(t.lanc.formas[gasto.forma_pagamento])}</p>
        )}
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
