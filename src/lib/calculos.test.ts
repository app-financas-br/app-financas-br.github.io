import { describe, expect, it } from "vitest";
import {
  datasParcelas,
  dividirParcelas,
  patrimonio,
  periodosParcelas,
  resumoMes,
  rotuloSaude,
  saudeMes,
  variacaoPercentual,
} from "./calculos";

describe("dividirParcelas", () => {
  it("aceite: R$ 100,00 em 3x = 33,33 + 33,33 + 33,34", () => {
    expect(dividirParcelas(10000, 3)).toEqual([3333, 3333, 3334]);
  });

  it("a soma das parcelas é sempre o total exato", () => {
    for (const [total, n] of [[1, 3], [999, 12], [123457, 7], [0, 2]] as const) {
      const p = dividirParcelas(total, n);
      expect(p).toHaveLength(n);
      expect(p.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it("recusa número de parcelas ou total inválidos", () => {
    expect(() => dividirParcelas(100, 0)).toThrow();
    expect(() => dividirParcelas(100, 2.5)).toThrow();
    expect(() => dividirParcelas(10.5, 2)).toThrow();
  });
});

describe("periodos e datas das parcelas", () => {
  it("aceite: em novembro, a 3ª parcela cai em janeiro do ano seguinte", () => {
    expect(periodosParcelas({ ano: 2026, mes: 11 }, 3)).toEqual([
      { ano: 2026, mes: 11 },
      { ano: 2026, mes: 12 },
      { ano: 2027, mes: 1 },
    ]);
  });

  it("aceite: vencimento dia 31 em 3x a partir de janeiro → 31/01, 28/02, 31/03", () => {
    expect(datasParcelas("2026-01-31", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("aceite: em ano bissexto, fevereiro fica 29", () => {
    expect(datasParcelas("2028-01-31", 3)).toEqual(["2028-01-31", "2028-02-29", "2028-03-31"]);
  });

  it("o dia volta ao original depois de um mês curto", () => {
    expect(datasParcelas("2026-01-30", 4)).toEqual(["2026-01-30", "2026-02-28", "2026-03-30", "2026-04-30"]);
  });
});

describe("resumoMes", () => {
  const base = {
    entradas: [
      { valor: "3000.00", recebido: true },
      { valor: 500, recebido: false }, // A receber
    ],
    contasFixas: [
      { valor: "1200.50", pago: true },
      { valor: 300, pago: false },
    ],
    gastos: [
      { valor: 52.9, pago: true },
      { valor: "30", pago: false },
    ],
    investimentos: [{ valor: 400 }, { valor: "-100" }], // aporte e resgate
  };

  it("Disponível = recebidas − fixas − gastos − investido (numeric como string ou número)", () => {
    expect(resumoMes({ ...base, soPago: false })).toEqual({
      entradasRecebidas: 300000,
      entradasAReceber: 50000,
      contasFixas: 150050,
      gastosVariaveis: 8290,
      investido: 30000,
      disponivel: 300000 - 150050 - 8290 - 30000,
    });
  });

  it("aceite: 'A receber' não altera o Disponível; marcar como recebido altera", () => {
    const antes = resumoMes({ ...base, soPago: false }).disponivel;
    const recebido = resumoMes({
      ...base,
      entradas: base.entradas.map((e) => ({ ...e, recebido: true })),
      soPago: false,
    }).disponivel;
    expect(recebido - antes).toBe(50000);
  });

  it("'contar só o que foi pago' ignora fixas e gastos pendentes", () => {
    const r = resumoMes({ ...base, soPago: true });
    expect(r.contasFixas).toBe(120050);
    expect(r.gastosVariaveis).toBe(5290);
  });

  it("evita erro de ponto flutuante (0,1 + 0,2)", () => {
    const r = resumoMes({
      entradas: [{ valor: 0.3, recebido: true }],
      contasFixas: [{ valor: 0.1, pago: true }],
      gastos: [{ valor: 0.2, pago: true }],
      investimentos: [],
      soPago: false,
    });
    expect(r.disponivel).toBe(0);
  });
});

describe("saúde, patrimônio e variação", () => {
  it("saúde = (fixas + gastos) ÷ recebidas, limitada a 100; sem entradas = null", () => {
    expect(saudeMes({ entradasRecebidas: 100000, contasFixas: 50000, gastosVariaveis: 25000 })).toBe(75);
    expect(saudeMes({ entradasRecebidas: 100000, contasFixas: 90000, gastosVariaveis: 50000 })).toBe(100);
    expect(saudeMes({ entradasRecebidas: 0, contasFixas: 1, gastosVariaveis: 0 })).toBeNull();
  });

  it("rótulos: Tranquilo < 70, Atenção 70–89, No limite ≥ 90", () => {
    expect(rotuloSaude(69)).toBe("Tranquilo");
    expect(rotuloSaude(70)).toBe("Atenção");
    expect(rotuloSaude(89)).toBe("Atenção");
    expect(rotuloSaude(90)).toBe("No limite");
  });

  it("patrimônio = saldo inicial + aportes − resgates", () => {
    expect(patrimonio("1000.00", [{ valor: 500 }, { valor: "-200.5" }])).toBe(129950);
  });

  it("variação % sobre o mês anterior; anterior zero = null", () => {
    expect(variacaoPercentual(110, 100)).toBeCloseTo(10);
    expect(variacaoPercentual(90, 100)).toBeCloseTo(-10);
    expect(variacaoPercentual(50, 0)).toBeNull();
  });
});
