import { describe, expect, it } from "vitest";
import { faturaAoMudarData, faturaDaCompra, faturaDaOpcao, faturasDasParcelas, faturasDoCartao, opcaoDaFatura, parcelaDaDescricao, regraDoCartao, sugerirFatura, type RegraCartao } from "./fatura";

const regra = (diaFechamento: number, diaVencimento: number, compraNoFechamentoProxima = true): RegraCartao => ({
  diaFechamento,
  diaVencimento,
  compraNoFechamentoProxima,
});
const mes = (data: string, r: RegraCartao) => {
  const f = faturaDaCompra(data, r);
  return `${f.ano}-${String(f.mes).padStart(2, "0")}`;
};

describe("compra no dia do fechamento (configurável por cartão)", () => {
  it("ligado (padrão): a compra NO dia do fechamento já vai para a fatura seguinte", () => {
    const r = regra(3, 10);
    expect(faturaDaCompra("2026-10-02", r)).toEqual({ ano: 2026, mes: 10, fechamento: "2026-10-03", vencimento: "2026-10-10" });
    expect(faturaDaCompra("2026-10-03", r)).toEqual({ ano: 2026, mes: 11, fechamento: "2026-11-03", vencimento: "2026-11-10" });
  });
  it("desligado: a compra NO dia do fechamento entra na fatura que fecha naquele dia", () => {
    const r = regra(3, 10, false);
    expect(faturaDaCompra("2026-10-03", r)).toEqual({ ano: 2026, mes: 10, fechamento: "2026-10-03", vencimento: "2026-10-10" });
    expect(mes("2026-10-04", r)).toBe("2026-11");
  });
});

describe("vencimento depois ou antes do fechamento", () => {
  it("fecha 3, vence 10: vence no mesmo mês do fechamento", () => {
    expect(mes("2026-10-01", regra(3, 10))).toBe("2026-10");
  });
  it("fecha 28, vence 5: vence no mês seguinte ao fechamento", () => {
    expect(faturaDaCompra("2026-10-16", regra(28, 5))).toEqual({ ano: 2026, mes: 11, fechamento: "2026-10-28", vencimento: "2026-11-05" });
    expect(faturaDaCompra("2026-10-29", regra(28, 5))).toEqual({ ano: 2026, mes: 12, fechamento: "2026-11-28", vencimento: "2026-12-05" });
  });
  it("vencimento no mesmo dia do fechamento conta como 'depois': mês seguinte", () => {
    expect(mes("2026-10-01", regra(10, 10))).toBe("2026-11");
  });
});

describe("meses curtos", () => {
  it("fechamento 31 em fevereiro comum = 28; em bissexto = 29", () => {
    expect(faturaDaCompra("2026-02-27", regra(31, 8)).fechamento).toBe("2026-02-28");
    expect(mes("2026-02-27", regra(31, 8))).toBe("2026-03");
    expect(mes("2026-02-28", regra(31, 8))).toBe("2026-04"); // no dia do fechamento (28) → próxima
    expect(mes("2026-02-28", regra(31, 8, false))).toBe("2026-03");
    expect(faturaDaCompra("2028-02-28", regra(31, 8)).fechamento).toBe("2028-02-29");
    expect(mes("2028-02-28", regra(31, 8))).toBe("2028-03");
  });
  it("fechamento 31 em abril (30 dias) e em março (31)", () => {
    expect(faturaDaCompra("2026-04-29", regra(31, 8)).fechamento).toBe("2026-04-30");
    expect(mes("2026-04-30", regra(31, 8))).toBe("2026-06"); // 30/04 é o dia do fechamento
    expect(faturaDaCompra("2026-03-30", regra(31, 8)).fechamento).toBe("2026-03-31");
  });
  it("vencimento dia 31 em mês de 30 dias vira dia 30", () => {
    expect(faturaDaCompra("2026-08-10", regra(20, 31)).vencimento).toBe("2026-08-31");
    expect(faturaDaCompra("2026-09-10", regra(20, 31)).vencimento).toBe("2026-09-30");
  });
});

describe("virada de ano", () => {
  it("compra em dezembro que vence em janeiro", () => {
    expect(faturaDaCompra("2026-12-20", regra(10, 17))).toEqual({ ano: 2027, mes: 1, fechamento: "2027-01-10", vencimento: "2027-01-17" });
  });
  it("compra em dezembro que vence em fevereiro (fecha em janeiro, vence no mês seguinte)", () => {
    expect(faturaDaCompra("2026-12-30", regra(28, 5))).toEqual({ ano: 2027, mes: 2, fechamento: "2027-01-28", vencimento: "2027-02-05" });
  });
});

describe("fatura atual e próxima", () => {
  it("a atual é a de uma compra feita hoje; a próxima fecha no mês seguinte", () => {
    const { atual, proxima } = faturasDoCartao("2026-10-16", regra(28, 5));
    expect(atual.vencimento).toBe("2026-11-05");
    expect(proxima.vencimento).toBe("2026-12-05");
    const dez = faturasDoCartao("2026-12-29", regra(28, 5));
    expect([dez.atual.vencimento, dez.proxima.vencimento]).toEqual(["2027-02-05", "2027-03-05"]);
  });
});

describe("parcelas e regra do cartão", () => {
  it("lê 'Parcela n/N' da descrição", () => {
    expect(parcelaDaDescricao("Loja Exemplo - Parcela 2/6")).toEqual({ num: 2, total: 6 });
    expect(parcelaDaDescricao("LOJA PARC 02/06")).toEqual({ num: 2, total: 6 });
    expect(parcelaDaDescricao("Curso parcela 3 de 10")).toEqual({ num: 3, total: 10 });
    expect(parcelaDaDescricao("Parcela 7/6")).toBeNull();
    expect(parcelaDaDescricao("Compra 2/6 avulsa")).toBeNull();
    expect(parcelaDaDescricao("Mercado")).toBeNull();
  });
  it("sem fechamento ou vencimento, não há regra (fica no mês da compra)", () => {
    expect(regraDoCartao({ dia_fechamento: null, dia_vencimento: 10, compra_no_fechamento_proxima: true })).toBeNull();
    expect(regraDoCartao({ dia_fechamento: 3, dia_vencimento: 10, compra_no_fechamento_proxima: false })).toEqual(regra(3, 10, false));
  });
});

describe("escolha do mês da fatura (Paga este mês / mês que vem)", () => {
  const fecha14 = regra(14, 21); // fecha dia 14, vence dia 21 do mesmo mês
  const p = (x: { ano: number; mes: number }) => `${x.ano}-${String(x.mes).padStart(2, "0")}`;

  it("fechamento dia 14: compra dia 10 sugere 'este mês'; dia 15 sugere 'mês que vem'", () => {
    const dia10 = sugerirFatura("2026-10-10", fecha14);
    const dia15 = sugerirFatura("2026-10-15", fecha14);
    expect([p(dia10), opcaoDaFatura("2026-10-10", dia10)]).toEqual(["2026-10", "este"]);
    expect([p(dia15), opcaoDaFatura("2026-10-15", dia15)]).toEqual(["2026-11", "proximo"]);
  });

  it("troca manual contra a sugestão: o botão marcado acompanha o mês escolhido", () => {
    expect(p(faturaDaOpcao("2026-10-15", "este"))).toBe("2026-10"); // sugestão era novembro
    expect(p(faturaDaOpcao("2026-10-10", "proximo"))).toBe("2026-11"); // sugestão era outubro
    expect(opcaoDaFatura("2026-10-10", { ano: 2027, mes: 1 })).toBe("outro"); // "Fatura de" livre
    expect(p(faturaDaOpcao("2026-12-20", "proximo"))).toBe("2027-01"); // vira o ano
  });

  it("cartão sem cadastro (ou sem fechamento/vencimento): começa em 'Paga este mês'", () => {
    const f = sugerirFatura("2026-10-28", null);
    expect([p(f), opcaoDaFatura("2026-10-28", f)]).toEqual(["2026-10", "este"]);
  });

  it("parcelado: a escolha vale para a 1ª parcela e as demais seguem mês a mês", () => {
    const este = faturasDasParcelas(faturaDaOpcao("2026-10-16", "este"), 3).map(p);
    const proximo = faturasDasParcelas(faturaDaOpcao("2026-10-16", "proximo"), 3).map(p);
    expect(este).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(proximo).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("mudar a data da compra: na sugestão segue a regra; escolha manual mantém a distância", () => {
    // Estava na sugestão (dia 10 → outubro); muda para dia 15 → novembro
    expect(p(faturaAoMudarData("2026-10-10", { ano: 2026, mes: 10 }, "2026-10-15", fecha14))).toBe("2026-11");
    // Tinha trocado para novembro à mão (sugestão era outubro); muda para 05/12 → mantém +1: janeiro
    expect(p(faturaAoMudarData("2026-10-10", { ano: 2026, mes: 11 }, "2026-12-05", fecha14))).toBe("2027-01");
    // Sem cadastro, "este mês" acompanha o mês da nova data
    expect(p(faturaAoMudarData("2026-10-10", { ano: 2026, mes: 10 }, "2026-09-30", null))).toBe("2026-09");
  });
});
