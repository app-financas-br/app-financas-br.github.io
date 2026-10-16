/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataOfx, decodificarOfx, lerOfx, valorOfx } from "./ofx";

const exemplo = (nome: string) =>
  new Uint8Array(readFileSync(new URL(`../features/importacao/__exemplos__/${nome}`, import.meta.url)));

describe("OFX SGML em windows-1252 (padrão Nubank, anonimizado)", () => {
  const bytes = exemplo("nubank-conta-sgml-1252.ofx");
  const extrato = lerOfx(decodificarOfx(bytes));

  it("o arquivo é mesmo latin-1 (não é UTF-8 válido)", () => {
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(bytes)).toThrow();
  });

  it("lê conta, banco e transações com acento", () => {
    expect(extrato).toMatchObject({ tipoConta: "banco", banco: "0260", conta: "99999999-9" });
    expect(extrato.transacoes).toHaveLength(5);
    expect(extrato.transacoes[1]).toEqual({ fitid: "EXEMPLO-NU-0002", data: "2026-10-06", centavos: -1850, descricao: "PADARIA SÃO JOÃO" });
    expect(extrato.transacoes[2]!.descricao).toBe("Compra no débito - FARMÁCIA AÇAÍ & CIA");
    expect(extrato.transacoes[2]!.centavos).toBe(-12990); // vírgula decimal
    expect(extrato.transacoes[0]!.centavos).toBe(350000);
  });

  it("DTPOSTED às 23h59 com fuso continua no mesmo dia", () => {
    expect(extrato.transacoes[2]!.data).toBe("2026-10-07");
  });
});

describe("OFX 2 XML em UTF-8 (padrão Inter, anonimizado)", () => {
  const extrato = lerOfx(decodificarOfx(exemplo("inter-conta-xml-utf8.ofx")));
  it("lê tags com fechamento, NAME + MEMO e acento em UTF-8", () => {
    expect(extrato).toMatchObject({ banco: "077", conta: "1234567-8" });
    expect(extrato.transacoes.map((t) => [t.data, t.centavos, t.descricao])).toEqual([
      ["2026-10-11", 50000, "PIX RECEBIDO - FULANO DE TAL - NU PAGAMENTOS"],
      ["2026-10-13", -8990, "Internet Fibra Exemplo"],
      ["2026-10-14", -650, "Café Expresso Ação"],
    ]);
  });
});

describe("partes do OFX", () => {
  it("cartão de crédito", () => {
    const e = lerOfx("<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CCACCTFROM><ACCTID>5555</CCACCTFROM><BANKTRANLIST><STMTTRN><DTPOSTED>20261001<TRNAMT>-10<MEMO>X</STMTTRN></BANKTRANLIST>");
    expect(e).toMatchObject({ tipoConta: "cartao", conta: "5555", banco: null });
    expect(e.transacoes[0]).toMatchObject({ fitid: null, centavos: -1000 });
  });
  it("datas", () => {
    expect(dataOfx("20261231235959.000[-3:BRT]")).toBe("2026-12-31");
    expect(dataOfx("20260230")).toBeNull();
    expect(dataOfx("2026")).toBeNull();
  });
  it("valores", () => {
    expect(valorOfx("-52.90")).toBe(-5290);
    expect(valorOfx("-52,9")).toBe(-5290);
    expect(valorOfx("1.234,56")).toBe(123456);
    expect(valorOfx("1,234.56")).toBe(123456);
    expect(valorOfx("+10")).toBe(1000);
    expect(valorOfx("1.234")).toBe(123400);
    expect(valorOfx("0.07")).toBe(7);
    expect(valorOfx("abc")).toBeNull();
  });
  it("transação sem data ou valor é descartada", () => {
    expect(lerOfx("<OFX><STMTTRN><TRNAMT>-1<MEMO>sem data</STMTTRN>").transacoes).toEqual([]);
  });
});
