import { describe, expect, it } from "vitest";
import {
  avisoPercentual,
  formatarBp,
  nivelBarra,
  paraBp,
  parsePercentual,
  planosFuturos,
  planoVigente,
  previstoPorGrupo,
  realizadoPorGrupo,
} from "./planejamento";

const soma = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);

describe("previstoPorGrupo", () => {
  it("padrão 50/10/10/20/10 de R$ 5.000,00", () => {
    const m = previstoPorGrupo(500000, [
      { id: "ess", bp: 5000 },
      { id: "laz", bp: 1000 },
      { id: "edu", bp: 1000 },
      { id: "lib", bp: 2000 },
      { id: "res", bp: 1000 },
    ]);
    expect([...m.values()]).toEqual([250000, 50000, 50000, 100000, 50000]);
  });

  it("com % somando 100, a soma é exatamente a renda (R$ 1.000,01 em 33,33/33,33/33,34)", () => {
    const m = previstoPorGrupo(100001, [
      { id: "a", bp: 3333 },
      { id: "b", bp: 3333 },
      { id: "c", bp: 3334 },
    ]);
    expect(soma(m)).toBe(100001);
    expect([...m.values()]).toEqual([33330, 33330, 33341]);
  });

  it("terços de R$ 0,10: o centavo que sobra vai para o maior resto (empate: o primeiro)", () => {
    const m = previstoPorGrupo(10, [
      { id: "a", bp: 3333 },
      { id: "b", bp: 3333 },
      { id: "c", bp: 3334 },
    ]);
    expect(soma(m)).toBe(10);
    expect([...m.values()]).toEqual([3, 3, 4]);
  });

  it("vários valores quebrados: soma sempre igual à renda", () => {
    const grupos = [
      { id: "a", bp: 1250 },
      { id: "b", bp: 3775 },
      { id: "c", bp: 1 },
      { id: "d", bp: 4974 },
    ];
    for (const renda of [1, 7, 99, 12345, 333333, 987654321]) expect(soma(previstoPorGrupo(renda, grupos))).toBe(renda);
  });

  it("% abaixo de 100 distribui só a parte planejada; renda 0 dá tudo 0", () => {
    expect(soma(previstoPorGrupo(100000, [{ id: "a", bp: 4500 }, { id: "b", bp: 5000 }]))).toBe(95000);
    expect([...previstoPorGrupo(0, [{ id: "a", bp: 5000 }]).values()]).toEqual([0]);
  });
});

describe("percentuais", () => {
  it("aviso quando não soma 100%", () => {
    expect(avisoPercentual(10000)).toEqual({ tipo: "ok" });
    expect(avisoPercentual(9500)).toEqual({ tipo: "faltam", bp: 500 });
    expect(avisoPercentual(10500)).toEqual({ tipo: "passou", bp: 500 });
  });

  it("lê e formata %", () => {
    expect(parsePercentual("12,5")).toBe(1250);
    expect(parsePercentual("50%")).toBe(5000);
    expect(parsePercentual("100")).toBe(10000);
    expect(parsePercentual("100,01")).toBeNull();
    expect(parsePercentual("-1")).toBeNull();
    expect(parsePercentual("abc")).toBeNull();
    expect(paraBp("33.34")).toBe(3334);
    expect(paraBp(20)).toBe(2000);
    expect(formatarBp(1250)).toBe("12,5%");
    expect(formatarBp(5000)).toBe("50%");
  });
});

describe("nivelBarra", () => {
  it("amarela a partir de 80%, vermelha acima de 100%", () => {
    expect(nivelBarra(79_99, 100_00)).toBe("normal");
    expect(nivelBarra(80_00, 100_00)).toBe("atencao");
    expect(nivelBarra(100_00, 100_00)).toBe("atencao");
    expect(nivelBarra(100_01, 100_00)).toBe("estourou");
    expect(nivelBarra(0, 0)).toBe("normal");
    expect(nivelBarra(1, 0)).toBe("estourou");
  });
});

describe("planoVigente", () => {
  const planos = [
    { ano: 2026, mes: 3, id: "mar" },
    { ano: 2026, mes: 11, id: "nov" },
    { ano: 2025, mes: 12, id: "dez25" },
  ];
  it("usa o próprio mês ou o último salvo antes dele, virando o ano", () => {
    expect(planoVigente(planos, { ano: 2026, mes: 3 })?.id).toBe("mar");
    expect(planoVigente(planos, { ano: 2026, mes: 10 })?.id).toBe("mar");
    expect(planoVigente(planos, { ano: 2026, mes: 1 })?.id).toBe("dez25");
    expect(planoVigente(planos, { ano: 2027, mes: 5 })?.id).toBe("nov");
    expect(planoVigente(planos, { ano: 2025, mes: 11 })).toBeNull();
  });
  it("planos futuros (os que 'aplicar aos próximos meses' substitui)", () => {
    expect(planosFuturos(planos, { ano: 2026, mes: 3 }).map((p) => p.id)).toEqual(["nov"]);
    expect(planosFuturos(planos, { ano: 2025, mes: 12 }).map((p) => p.id)).toEqual(["mar", "nov"]);
  });
});

describe("realizadoPorGrupo", () => {
  const categorias = [
    { id: "alim", grupo_id: "ess" },
    { id: "lazer", grupo_id: "laz" },
    { id: "outros", grupo_id: null },
    { id: "rf", grupo_id: "lib" },
    { id: "cripto", grupo_id: "lib" },
    { id: "reserva", grupo_id: "res" },
  ];
  const contas = [{ valor: "1200", pago: true, categoria_id: "alim" }];
  const gastos = [
    { valor: 300.5, pago: false, categoria_id: "alim" },
    { valor: 80, pago: true, categoria_id: "lazer" },
    { valor: 25, pago: true, categoria_id: "outros" },
    { valor: 10, pago: true, categoria_id: null },
  ];
  const investimentos = [
    { valor: 500, categoria_id: "rf" },
    { valor: -100, categoria_id: "cripto" },
    { valor: -300, categoria_id: "reserva" },
  ];

  it("soma pela ligação categoria → grupo; sem grupo (ou sem categoria) vai para null", () => {
    const m = realizadoPorGrupo({ categorias, contas, gastos, investimentos, soPago: false });
    expect(m.get("ess")).toBe(150050);
    expect(m.get("laz")).toBe(8000);
    expect(m.get(null)).toBe(3500);
    expect(m.get("lib")).toBe(40000); // 500 − 100 de resgate
    expect(m.get("res")).toBe(0); // só resgate: mínimo 0
  });

  it("com 'contar só o que foi pago', pendentes ficam de fora", () => {
    const m = realizadoPorGrupo({ categorias, contas, gastos, investimentos, soPago: true });
    expect(m.get("ess")).toBe(120000);
  });
});
