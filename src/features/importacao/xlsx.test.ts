import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { aplicarMapeamento, encontrarCabecalho, sugerirMapeamento, MODELO } from "../../lib/planilha";
import { gerarModeloXlsx, lerXlsx } from "./xlsx";

describe("modelo do app (.xlsx)", () => {
  it("a aba lida tem só o cabeçalho; exemplos ficam em 'Como preencher' e não são importados", async () => {
    const linhas = await lerXlsx(await gerarModeloXlsx());
    expect(linhas[0]).toEqual(MODELO.cabecalho);
    const { transacoes } = aplicarMapeamento(linhas, 0, sugerirMapeamento(linhas[0]!));
    expect(transacoes).toEqual([]);
  });

  it("modelo preenchido: datas do Excel, números e fórmula", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await gerarModeloXlsx());
    const aba = wb.getWorksheet("Lançamentos")!;
    aba.addRow([new Date(Date.UTC(2026, 9, 5)), "Salário", 3500, "Entrada", ""]);
    aba.addRow([new Date(Date.UTC(2026, 9, 6)), "Mercado", 245.9, "Gasto", "Alimentação"]);
    aba.addRow([new Date(Date.UTC(2026, 9, 31)), "Aluguel", { formula: "1000+200", result: 1200 }, "Conta fixa", "Casa"]);
    const bytes = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const linhas = await lerXlsx(bytes);
    const cab = encontrarCabecalho(linhas);
    const { transacoes, ignoradas } = aplicarMapeamento(linhas, cab, sugerirMapeamento(linhas[cab]!));
    expect(ignoradas).toEqual([]);
    expect(transacoes.map((t) => [t.data, t.centavos, t.descricao, t.tipo, t.categoria])).toEqual([
      ["2026-10-05", 350000, "Salário", "entrada", null],
      ["2026-10-06", -24590, "Mercado", "gasto", "Alimentação"],
      ["2026-10-31", -120000, "Aluguel", "conta_fixa", "Casa"],
    ]);
  });
});
