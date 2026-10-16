// Linhas da pré-visualização → itens da RPC importar_lancamentos (puro, testado).

import { deCentavos } from "../../lib/dinheiro";
import { valorParaTipo, type ContaFixaAberta, type SugestaoTransferencia, type TipoImportacao } from "../../lib/importacao";

export type TipoLinha = TipoImportacao | "transferencia";

export type LinhaRevisao = {
  id: string;
  chave: string;
  data: string;
  /** Centavos com sinal: crédito > 0, débito < 0. */
  centavos: number;
  descricao: string;
  /** A chave já existe na conta: não pode ser importada de novo. */
  repetida: boolean;
  incluir: boolean;
  tipo: TipoLinha;
  categoriaId: string | null;
  /** Para tipo "transferencia": a outra conta minha. */
  outraContaId: string | null;
  sugestao: SugestaoTransferencia | null;
  /** A pessoa confirmou a sugestão de transferência. */
  transfConfirmada: boolean;
  contaFixa: ContaFixaAberta | null;
  marcarPaga: boolean;
};

export type ItemRpc = Record<string, string | number | null>;

/** O que a linha vai fazer ao confirmar (null = nada). */
export function acaoDaLinha(l: LinhaRevisao): "importar" | "so_chave" | null {
  if (l.repetida) return null;
  if (l.sugestao?.tipo === "ja_registrada") return "so_chave";
  return l.incluir ? "importar" : null;
}

/**
 * Monta os itens da RPC. Transferência: débito sai desta conta; crédito sai da outra
 * (a chave fica sempre na conta do extrato). Sugestão confirmada contra lançamento já
 * gravado converte esse lançamento (mesmo id), guardando o tipo que a linha teria.
 */
export function montarItens(linhas: LinhaRevisao[], contaId: string, formaPagamento: "debito" | "credito"): ItemRpc[] {
  const itens: ItemRpc[] = [];
  for (const l of linhas) {
    const acao = acaoDaLinha(l);
    if (!acao) continue;
    const base = { chave: l.chave, conta_id: contaId, data: l.data, descricao: l.descricao };

    if (acao === "so_chave") {
      itens.push({ ...base, tipo: "so_chave", valor: 0 });
    } else if (l.contaFixa && l.marcarPaga) {
      itens.push({ ...base, tipo: "conta_fixa_paga", valor: deCentavos(Math.abs(l.centavos)), par_id: l.contaFixa.id });
    } else if (l.tipo === "transferencia") {
      if (!l.outraContaId) continue;
      const sai = l.centavos < 0;
      const item: ItemRpc = {
        ...base,
        tipo: "transferencia",
        valor: deCentavos(Math.abs(l.centavos)),
        conta_origem_id: sai ? contaId : l.outraContaId,
        conta_destino_id: sai ? l.outraContaId : contaId,
      };
      const s = l.sugestao;
      if (l.transfConfirmada && s?.tipo === "gravado" && s.par.contaId === l.outraContaId) {
        // Data da transferência = data da ponta de SAÍDA; a da linha fica guardada para o Desfazer
        if (!sai) {
          item.data = s.par.data;
          item.data_linha = l.data;
        }
        item.par_tabela = s.par.tabela;
        item.par_id = s.par.id;
        item.novo_tipo = sai ? "gasto" : "entrada";
        item.novo_categoria_id = sai ? l.categoriaId : null;
      }
      itens.push(item);
    } else {
      itens.push({
        ...base,
        tipo: l.tipo,
        valor: deCentavos(valorParaTipo(l.tipo, l.centavos)),
        categoria_id: l.tipo === "entrada" ? null : l.categoriaId,
        ...(l.tipo === "gasto" ? { forma_pagamento: formaPagamento } : {}),
      });
    }
  }
  return itens;
}

/** Linhas que precisam de atenção antes de confirmar (transferência sem a outra conta). */
export const linhasIncompletas = (linhas: LinhaRevisao[]) =>
  linhas.filter((l) => acaoDaLinha(l) === "importar" && l.tipo === "transferencia" && !l.outraContaId && !(l.contaFixa && l.marcarPaga));
