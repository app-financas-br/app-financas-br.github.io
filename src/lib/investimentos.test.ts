import { describe, expect, it } from "vitest";
import { patrimonioPorMes, resumoInvestimentos, saldoInicialParaPatrimonio, saldoPorCategoria } from "./investimentos";
import { mesesAtePrazo, pctMeta, planoMeta } from "./metas";

const inv = [
  { ano: 2025, mes: 12, valor: "1000.00", categoria_id: "rf" },
  { ano: 2026, mes: 1, valor: 500, categoria_id: "rf" },
  { ano: 2026, mes: 3, valor: 300.1, categoria_id: "acoes" },
  { ano: 2026, mes: 3, valor: -200, categoria_id: "rf" }, // resgate
  { ano: 2027, mes: 1, valor: 999, categoria_id: "rf" }, // ano seguinte não entra em 2026
];

describe("investimentos", () => {
  it("aportes, resgates e líquido", () => {
    expect(resumoInvestimentos(inv.filter((i) => i.ano === 2026 && i.mes === 3))).toEqual({ aportes: 30010, resgates: 20000, liquido: 10010 });
    expect(resumoInvestimentos([])).toEqual({ aportes: 0, resgates: 0, liquido: 0 });
  });

  it("patrimônio ao fim de cada mês inclui anos anteriores e o saldo inicial", () => {
    const p = patrimonioPorMes("100", inv, 2026);
    expect(p).toHaveLength(12);
    expect(p[0]).toEqual({ mes: 1, patrimonio: 160000, liquido: 50000 }); // 100 + 1000 + 500
    expect(p[1]).toEqual({ mes: 2, patrimonio: 160000, liquido: 0 });
    expect(p[2]).toEqual({ mes: 3, patrimonio: 170010, liquido: 10010 });
    expect(p[11]!.patrimonio).toBe(170010);
  });

  it("saldo por categoria (todos os anos), sem zerados", () => {
    expect(saldoPorCategoria([...inv, { ano: 2026, mes: 4, valor: -300.1, categoria_id: "acoes" }])).toEqual([{ categoriaId: "rf", centavos: 229900 }]);
  });

  it("editar o patrimônio ajusta só o saldo inicial pela diferença", () => {
    // patrimônio atual = 100 + 2599,10 = 2699,10; quero 3000 → saldo inicial vira 400,90
    expect(saldoInicialParaPatrimonio(300000, "100", inv)).toBe(40090);
  });
});

describe("metas", () => {
  it("% reservado, sem passar de 100", () => {
    expect(pctMeta(250, 1000)).toBe(25);
    expect(pctMeta("999.99", 1000)).toBe(99); // não arredonda para 100 antes de completar
    expect(pctMeta(1500, 1000)).toBe(100);
    expect(pctMeta(0, 0)).toBe(0);
  });

  it("meses até o prazo contam o mês atual; prazo passado = 0", () => {
    expect(mesesAtePrazo("2026-10-16", "2026-12-31")).toBe(3);
    expect(mesesAtePrazo("2026-10-16", "2026-10-31")).toBe(1);
    expect(mesesAtePrazo("2026-10-16", "2027-01-01")).toBe(4); // vira o ano
    expect(mesesAtePrazo("2026-10-16", "2026-10-15")).toBe(0);
  });

  it("quanto guardar por mês (para cima, em centavos)", () => {
    expect(planoMeta({ valor_alvo: 1000, reservado: 0, prazo: "2026-12-31", concluida: false }, "2026-10-16")).toEqual({
      situacao: "em_dia", falta: 100000, meses: 3, porMes: 33334,
    });
    expect(planoMeta({ valor_alvo: 1000, reservado: 1000, prazo: null, concluida: false }, "2026-10-16")).toEqual({ situacao: "atingida" });
    expect(planoMeta({ valor_alvo: 1000, reservado: 0, prazo: null, concluida: false }, "2026-10-16")).toEqual({ situacao: "sem_prazo", falta: 100000 });
    expect(planoMeta({ valor_alvo: 1000, reservado: 400, prazo: "2026-01-01", concluida: false }, "2026-10-16")).toEqual({ situacao: "vencida", falta: 60000 });
    expect(planoMeta({ valor_alvo: 1000, reservado: 0, prazo: null, concluida: true }, "2026-10-16")).toEqual({ situacao: "concluida" });
  });
});
