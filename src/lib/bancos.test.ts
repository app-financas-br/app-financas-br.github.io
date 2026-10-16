/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodificarOfx } from "./ofx";
import { lerCsv } from "./planilha";
import { chavesDasLinhas } from "./importacao";
import { lerCsvDeBanco } from "./bancos";

const csv = (nome: string) =>
  lerCsv(decodificarOfx(new Uint8Array(readFileSync(new URL(`../features/importacao/__exemplos__/${nome}`, import.meta.url)))));

describe("Nubank conta (CSV, anonimizado)", () => {
  const r = lerCsvDeBanco(csv("nubank-conta-csv.csv"))!;

  it("reconhece pelo cabeçalho e lê sinal, acento e descrição com vírgula entre aspas", () => {
    expect(r).toMatchObject({ banco: "Nubank", tipoConta: "banco", ignoradas: [] });
    expect(r.transacoes.map((t) => [t.data, t.centavos, t.descricao])).toEqual([
      ["2026-10-05", 350000, "Transferência recebida pelo Pix - EMPRESA EXEMPLO LTDA - CNPJ 00.000.000/0001-00"],
      ["2026-10-06", -1850, "Compra no débito - PADARIA SÃO JOÃO"],
      ["2026-10-10", -50000, "Transferência enviada pelo Pix - FULANO DE TAL - •••.000.000-•• - INTER"],
      ["2026-10-15", -152035, "Pagamento de fatura"],
    ]);
  });

  it("o Identificador do Nubank vira a chave (reimportar não duplica)", async () => {
    expect(r.transacoes[0]!.fitid).toBe("nubank:00000000-0000-4000-8000-000000000001");
    const chaves = await chavesDasLinhas("conta", r.transacoes);
    expect(chaves[0]).toBe("ofx:nubank:00000000-0000-4000-8000-000000000001");
    expect(await chavesDasLinhas("conta", lerCsvDeBanco(csv("nubank-conta-csv.csv"))!.transacoes)).toEqual(chaves);
  });
});

describe("Nubank cartão (CSV, anonimizado)", () => {
  const r = lerCsvDeBanco(csv("nubank-cartao-csv.csv"))!;

  it("compra positiva no arquivo vira saída; estorno e pagamento viram crédito", () => {
    expect(r).toMatchObject({ banco: "Nubank", tipoConta: "cartao", ignoradas: [] });
    expect(r.transacoes.map((t) => [t.data, t.centavos, t.descricao, t.tipo])).toEqual([
      ["2026-09-28", -24590, "Mercado Exemplo", null],
      ["2026-09-30", -9999, "Loja Exemplo - Parcela 2/6", null],
      ["2026-10-01", -2345, "Uber *Trip", null],
      ["2026-10-02", 1500, 'Estorno de "Loja Exemplo"', null], // aspas no meio do campo
      ["2026-10-15", 152035, "Pagamento recebido", "transferencia"],
    ]);
  });

  it("sem id no arquivo: chave por hash, estável ao reimportar", async () => {
    const a = await chavesDasLinhas("cartao", r.transacoes);
    expect(a.every((c) => c.startsWith("h:"))).toBe(true);
    expect(await chavesDasLinhas("cartao", lerCsvDeBanco(csv("nubank-cartao-csv.csv"))!.transacoes)).toEqual(a);
  });

  it("versão com coluna category traz a categoria", () => {
    const x = lerCsvDeBanco([["date", "category", "title", "amount"], ["2026-10-01", "transporte", "Uber", "10.00"]])!;
    expect(x.transacoes[0]).toMatchObject({ centavos: -1000, descricao: "Uber", categoria: "transporte" });
  });
});

describe("formato desconhecido", () => {
  it("cai no mapeamento genérico", () => {
    expect(lerCsvDeBanco([["Data", "Histórico", "Valor"], ["01/10/2026", "X", "1"]])).toBeNull();
    expect(lerCsvDeBanco([])).toBeNull();
  });
});
