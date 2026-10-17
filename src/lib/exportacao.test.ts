import { describe, expect, it } from "vitest";
import { montarAbas, nomeArquivo, periodosDaExportacao } from "./exportacao";
import { dados } from "./exportacao.exemplo";

describe("montarAbas", () => {
  const abas = montarAbas(dados, periodosDaExportacao(2026), false);
  const aba = (nome: string) => abas.find((a) => a.nome === nome)!;

  it("Resumo + uma aba por tabela", () => {
    expect(abas.map((a) => a.nome)).toEqual(["Resumo", "Entradas", "Contas fixas", "Gastos variáveis", "Investimentos"]);
  });

  it("ano: uma linha por lançamento, com Ano e Mês do lançamento, em ordem; outro ano fica de fora", () => {
    const g = aba("Gastos variáveis");
    expect(g.colunas.slice(0, 3).map((c) => c.titulo)).toEqual(["Ano", "Mês", "Data"]);
    expect(g.linhas.map((l) => [l[0], l[1], l[2], l[5]])).toEqual([
      [2026, 1, "2026-01-31", 1000],
      [2026, 10, "2026-10-16", 5290],
      [2026, 11, "2026-10-10", 8333], // compra 10/10 que conta em novembro (fatura)
    ]);
    expect(g.linhas[2]!.slice(6, 10)).toEqual(["Crédito", "Cartão Nubank", "Pago", "2/3"]);
  });

  it("Resumo do ano: 12 meses, valores em centavos iguais ao Disponível", () => {
    const r = aba("Resumo");
    expect(r.linhas).toHaveLength(12);
    // Outubro: 3000 recebido − 1200 conta − 52,90 gasto − (−200 resgate) = 1947,10
    expect(r.linhas[9]).toEqual([2026, 10, 300000, 0, 120000, 5290, -20000, 194710]);
    expect(r.linhas[10]!.slice(0, 2)).toEqual([2026, 11]);
    expect(r.linhas[10]![5]).toBe(8333);
  });

  it("mês: só aquele mês; categoria, status e tipo do investimento por extenso", () => {
    const m = montarAbas(dados, periodosDaExportacao(2026, 10), true);
    expect(m[0]!.linhas).toEqual([[2026, 10, 300000, 0, 0, 5290, -20000, 314710]]); // só pagos: aluguel pendente não desconta
    expect(m[3]!.linhas.map((l) => l[3])).toEqual(["Gasto g1"]);
    expect(m[2]!.linhas[0]!.slice(4, 7)).toEqual(["Casa", 120000, "Pendente"]);
    expect(m[4]!.linhas[0]!.slice(4)).toEqual(["Renda fixa", "Resgate", -20000]);
    expect(m[1]!.linhas[0]!.slice(4, 6)).toEqual([300000, "Recebido"]);
  });
});

describe("nome do arquivo", () => {
  it("mês com dois dígitos ou ano", () => {
    expect(nomeArquivo(2026, 3)).toBe("financas-2026-03.xlsx");
    expect(nomeArquivo(2026)).toBe("financas-2026.xlsx");
  });
});
