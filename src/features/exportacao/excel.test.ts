/// <reference types="node" />
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { gerarExcel } from "./excel";
import { montarAbas, periodosDaExportacao } from "../../lib/exportacao";
import { dados } from "../../lib/exportacao.exemplo";

// Critério de aceite (docs/05-roadmap.md): Excel do ano com uma linha por lançamento e colunas Ano e Mês corretas
describe("gerarExcel", () => {
  it("grava e relê o .xlsx do ano: Ano/Mês corretos, data sem mudar de dia e valor em reais", async () => {
    const buf = await gerarExcel(montarAbas(dados, periodosDaExportacao(2026), false), "BRL");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Entradas", "Contas fixas", "Gastos variáveis", "Investimentos"]);

    const g = wb.getWorksheet("Gastos variáveis")!;
    expect(g.rowCount).toBe(4); // cabeçalho + 3 gastos de 2026
    expect(g.getRow(1).values).toEqual(expect.arrayContaining(["Ano", "Mês", "Data", "Descrição", "Valor"]));
    const linhas = [2, 3, 4].map((n) => {
      const r = g.getRow(n);
      const data = r.getCell(3).value as Date;
      return [r.getCell(1).value, r.getCell(2).value, data.toISOString().slice(0, 10), r.getCell(6).value];
    });
    expect(linhas).toEqual([
      [2026, 1, "2026-01-31", 10],
      [2026, 10, "2026-10-16", 52.9],
      [2026, 11, "2026-10-10", 83.33],
    ]);
    expect(g.getCell("F2").numFmt).toContain("R$");
    expect(g.getCell("C2").numFmt).toBe("dd/mm/yyyy");
    expect(wb.getWorksheet("Resumo")!.rowCount).toBe(13);
  });

  it("formato de número segue a moeda escolhida", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await gerarExcel(montarAbas(dados, periodosDaExportacao(2026, 10), false), "USD"));
    expect(wb.getWorksheet("Gastos variáveis")!.getCell("F2").numFmt).toContain("US$");
  });
});
