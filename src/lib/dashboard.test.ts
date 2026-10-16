import { describe, expect, it } from "vitest";
import { acumuladoDiario, agruparPequenas, ateHoje, contasAVencer, diaNoPeriodo, limiteJanela, porCategoria, ultimosLancamentos } from "./dashboard";

const out = { ano: 2026, mes: 10 };

describe("série diária", () => {
  it("dia no período; sem data ou de outro mês conta no dia 1", () => {
    expect(diaNoPeriodo("2026-10-16", out)).toBe(16);
    expect(diaNoPeriodo(null, out)).toBe(1);
    expect(diaNoPeriodo("2026-09-30", out)).toBe(1);
  });

  it("acumula dia a dia até o último dia do mês, em centavos", () => {
    const s = acumuladoDiario([{ valor: "10.50", dia: 1 }, { valor: 5, dia: 3 }, { valor: 0.1, dia: 3 }], out);
    expect(s).toHaveLength(31);
    expect(s.slice(0, 4)).toEqual([1050, 1050, 1560, 1560]);
    expect(s[30]).toBe(1560);
  });

  it("no mês atual a série para em hoje; em outro mês fica inteira", () => {
    const s = acumuladoDiario([], out);
    expect(ateHoje(s, out, "2026-10-16")).toHaveLength(16);
    expect(ateHoje(s, out, "2026-11-02")).toHaveLength(31);
  });
});

describe("agruparPequenas", () => {
  const f = (categoriaId: string, centavos: number) => ({ categoriaId, centavos });
  it("junta fatias abaixo de 3% em 'Outras'", () => {
    const r = agruparPequenas([f("a", 9000), f("b", 600), f("c", 250), f("d", 150)]);
    expect(r.fatias.map((x) => x.categoriaId)).toEqual(["a", "b"]);
    expect(r.outras.map((x) => x.categoriaId)).toEqual(["c", "d"]);
  });
  it("exatamente 3% não é pequena; uma só pequena fica com o nome", () => {
    expect(agruparPequenas([f("a", 9700), f("b", 300)]).outras).toEqual([]);
    expect(agruparPequenas([f("a", 9800), f("b", 200)]).fatias).toHaveLength(2);
  });
});

describe("porCategoria", () => {
  it("soma por categoria, ordena e ignora zerados", () => {
    expect(
      porCategoria([
        { valor: 100, categoria_id: "a" },
        { valor: "250.5", categoria_id: "b" },
        { valor: 50, categoria_id: "a" },
        { valor: 0, categoria_id: "c" },
        { valor: 20, categoria_id: null },
      ]),
    ).toEqual([
      { categoriaId: "b", centavos: 25050 },
      { categoriaId: "a", centavos: 15000 },
      { categoriaId: null, centavos: 2000 },
    ]);
  });
});

describe("contasAVencer", () => {
  const conta = (id: string, vencimento: string | null, pago = false) => ({ id, descricao: id, valor: 10, pago, vencimento });

  it("atrasadas e as dos próximos 7 dias, mais urgente primeiro; pagas e sem data ficam fora", () => {
    const r = contasAVencer(
      [
        conta("hoje", "2026-10-16"),
        conta("atrasada", "2026-10-10"),
        conta("dia7", "2026-10-23"),
        conta("dia8", "2026-10-24"),
        conta("paga", "2026-10-12", true),
        conta("semdata", null),
      ],
      "2026-10-16",
    );
    expect(r.map((c) => [c.id, c.diasAte, c.atrasada])).toEqual([
      ["atrasada", -6, true],
      ["hoje", 0, false],
      ["dia7", 7, false],
    ]);
  });

  it("atravessa a virada do mês e do ano", () => {
    expect(contasAVencer([conta("jan", "2027-01-02")], "2026-12-30")[0]?.diasAte).toBe(3);
    expect(limiteJanela("2026-12-28")).toBe("2027-01-04");
  });
});

describe("ultimosLancamentos", () => {
  it("junta as tabelas e pega os mais recentes", () => {
    const r = ultimosLancamentos(
      [
        { tipo: "entrada", itens: [{ id: "e", descricao: "Salário", valor: 3000, created_at: "2026-10-05T10:00:00Z" }] },
        { tipo: "gasto", itens: [{ id: "g", descricao: "Mercado", valor: "52.9", created_at: "2026-10-16T09:00:00Z" }] },
        { tipo: "conta", itens: [{ id: "c", descricao: "Luz", valor: 120, created_at: "2026-10-10T08:00:00Z" }] },
      ],
      2,
    );
    expect(r.map((i) => [i.id, i.tipo, i.centavos])).toEqual([
      ["g", "gasto", 5290],
      ["c", "conta", 12000],
    ]);
  });
});
