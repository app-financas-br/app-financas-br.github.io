import { describe, expect, it } from "vitest";
import { linhasReplicarMes, linhasRepetir, mesesAteDezembro, mesesComMesmaConta } from "./regrasReplicar";
import type { ContaFixa, Entrada } from "./tipos";

const conta = (c: Partial<ContaFixa>): ContaFixa => ({
  id: "c1", ano: 2026, mes: 10, descricao: "Internet teste", valor: "99.90", origem: "manual", created_at: "",
  pago: true, vencimento: "2026-10-31", categoria_id: "casa", grupo_parcela: null, parcela_num: null, parcela_total: null,
  ...c,
});
const entrada = (e: Partial<Entrada>): Entrada => ({
  id: "e1", ano: 2026, mes: 10, descricao: "Salário", valor: 3000, origem: "manual", created_at: "",
  recebido: true, data: "2026-10-05", ...e,
});

describe("Replicar mês", () => {
  it("entradas chegam como 'A receber', sem o saldo do mês anterior", () => {
    const linhas = linhasReplicarMes(
      "entradas",
      [entrada({}), entrada({ id: "e2", descricao: "Saldo de Setembro", origem: "saldo_anterior" })],
      { ano: 2026, mes: 11 },
    );
    expect(linhas).toEqual([
      { ano: 2026, mes: 11, descricao: "Salário", valor: 3000, recebido: false, data: "2026-11-05", origem: "replicado" },
    ]);
  });

  it("contas chegam Pendentes, com 31→30, categoria mantida e sem parcelas", () => {
    const linhas = linhasReplicarMes(
      "contas_fixas",
      [conta({}), conta({ id: "c2", grupo_parcela: "g", parcela_num: 1, parcela_total: 3 })],
      { ano: 2026, mes: 11 },
    );
    expect(linhas).toEqual([
      { ano: 2026, mes: 11, descricao: "Internet teste", valor: "99.90", pago: false, vencimento: "2026-11-30", categoria_id: "casa", origem: "replicado" },
    ]);
  });
});

describe("Repetir até dezembro", () => {
  it("de outubro gera novembro e dezembro; de dezembro não gera nada", () => {
    expect(mesesAteDezembro({ ano: 2026, mes: 10 })).toEqual([{ ano: 2026, mes: 11 }, { ano: 2026, mes: 12 }]);
    expect(mesesAteDezembro({ ano: 2026, mes: 12 })).toEqual([]);
  });

  it("aponta os meses que já têm a mesma conta (ignora maiúsculas, acento e espaços)", () => {
    const meses = mesesAteDezembro({ ano: 2026, mes: 10 });
    const existentes = [
      { ano: 2026, mes: 11, descricao: "  INTERNET   Teste " },
      { ano: 2026, mes: 12, descricao: "Internet fibra" }, // outra conta: não é duplicata
      { ano: 2027, mes: 11, descricao: "Internet teste" }, // outro ano: não conta
    ];
    expect(mesesComMesmaConta("Internet teste", meses, existentes)).toEqual([{ ano: 2026, mes: 11 }]);
  });

  it("pular os duplicados cria só os meses livres, com o vencimento certo de cada mês", () => {
    const c = conta({});
    const meses = mesesAteDezembro(c);
    const duplicados = mesesComMesmaConta(c.descricao, meses, [{ ano: 2026, mes: 11, descricao: "Internet teste" }]);
    const livres = meses.filter((m) => !duplicados.some((d) => d.mes === m.mes && d.ano === m.ano));
    expect(linhasRepetir(c, livres)).toEqual([
      { ano: 2026, mes: 12, descricao: "Internet teste", valor: "99.90", pago: false, vencimento: "2026-12-31", categoria_id: "casa", origem: "replicado" },
    ]);
  });

  it("criar mesmo assim gera todos os meses (31 → 30/11 → 31/12)", () => {
    const c = conta({});
    expect(linhasRepetir(c, mesesAteDezembro(c)).map((l) => l.vencimento)).toEqual(["2026-11-30", "2026-12-31"]);
  });
});
