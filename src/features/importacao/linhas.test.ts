import { describe, expect, it } from "vitest";
import { acaoDaLinha, linhasIncompletas, montarItens, type LinhaRevisao } from "./linhas";

const linha = (p: Partial<LinhaRevisao>): LinhaRevisao => ({
  id: "1",
  chave: "ofx:1",
  data: "2026-10-10",
  centavos: -1850,
  descricao: "Padaria",
  repetida: false,
  incluir: true,
  tipo: "gasto",
  categoriaId: "alim",
  outraContaId: null,
  sugestao: null,
  transfConfirmada: false,
  contaFixa: null,
  marcarPaga: false,
  ...p,
});

describe("montarItens", () => {
  it("gasto, entrada e investimento com o valor da tabela", () => {
    const itens = montarItens(
      [
        linha({}),
        linha({ chave: "ofx:2", tipo: "entrada", centavos: 350000, categoriaId: "x" }),
        linha({ chave: "ofx:3", tipo: "investimento", centavos: -100000, categoriaId: "rf" }),
      ],
      "nu",
      "debito",
    );
    expect(itens).toEqual([
      { chave: "ofx:1", conta_id: "nu", data: "2026-10-10", descricao: "Padaria", tipo: "gasto", valor: 18.5, categoria_id: "alim", forma_pagamento: "debito" },
      { chave: "ofx:2", conta_id: "nu", data: "2026-10-10", descricao: "Padaria", tipo: "entrada", valor: 3500, categoria_id: null },
      { chave: "ofx:3", conta_id: "nu", data: "2026-10-10", descricao: "Padaria", tipo: "investimento", valor: 1000, categoria_id: "rf" },
    ]);
  });

  it("repetidas e ignoradas não vão; transferência já registrada só grava a chave", () => {
    const itens = montarItens(
      [linha({ repetida: true }), linha({ chave: "b", incluir: false }), linha({ chave: "c", sugestao: { tipo: "ja_registrada" }, incluir: false })],
      "nu",
      "debito",
    );
    expect(itens).toEqual([{ chave: "c", conta_id: "nu", data: "2026-10-10", descricao: "Padaria", tipo: "so_chave", valor: 0 }]);
    expect(acaoDaLinha(linha({ repetida: true, sugestao: { tipo: "ja_registrada" } }))).toBeNull();
  });

  it("conta fixa marcada como paga não cria lançamento", () => {
    const cf = { id: "net", descricao: "Internet", valor: 89.9, pago: false, ano: 2026, mes: 10 };
    expect(montarItens([linha({ contaFixa: cf, marcarPaga: true, centavos: -8990 })], "inter", "debito")[0]).toMatchObject({
      tipo: "conta_fixa_paga",
      par_id: "net",
      valor: 89.9,
    });
  });

  it("transferência: débito sai desta conta, crédito sai da outra", () => {
    const [saida, entrada] = montarItens(
      [
        linha({ tipo: "transferencia", outraContaId: "inter", centavos: -50000 }),
        linha({ chave: "x", tipo: "transferencia", outraContaId: "inter", centavos: 50000 }),
      ],
      "nu",
      "debito",
    );
    expect(saida).toMatchObject({ conta_id: "nu", conta_origem_id: "nu", conta_destino_id: "inter", valor: 500 });
    expect(entrada).toMatchObject({ conta_id: "nu", conta_origem_id: "inter", conta_destino_id: "nu", valor: 500 });
    expect(saida).not.toHaveProperty("par_id");
  });

  it("sugestão confirmada contra lançamento gravado converte o mesmo id", () => {
    const par = { id: "g1", tabela: "entradas" as const, contaId: "inter", data: "2026-10-11", centavos: 50000, descricao: "PIX RECEBIDO" };
    const sugestao = { tipo: "gravado" as const, par, outraContaId: "inter" };
    const [item] = montarItens(
      [linha({ tipo: "transferencia", outraContaId: "inter", centavos: -50000, sugestao, transfConfirmada: true })],
      "nu",
      "debito",
    );
    expect(item).toMatchObject({ par_tabela: "entradas", par_id: "g1", novo_tipo: "gasto", novo_categoria_id: "alim" });
    // Sem confirmar, não converte nada
    const [semConfirmar] = montarItens([linha({ tipo: "transferencia", outraContaId: "inter", centavos: -50000, sugestao })], "nu", "debito");
    expect(semConfirmar).not.toHaveProperty("par_id");
  });

  it("transferência sem a outra conta fica pendente e não é enviada", () => {
    const l = linha({ tipo: "transferencia" });
    expect(linhasIncompletas([l])).toHaveLength(1);
    expect(montarItens([l], "nu", "debito")).toEqual([]);
  });
});
