// Grava as abas em .xlsx com exceljs, carregado só quando a pessoa exporta (não pesa no app).
import type { Aba } from "../../lib/exportacao";
import type { Moeda } from "../../lib/dinheiro";
import { parseData } from "../../lib/datas";

/** Formato de número conforme a moeda escolhida (Excel ajusta separadores ao idioma do computador). */
const FORMATO_MOEDA: Record<Moeda, string> = {
  BRL: '"R$" #,##0.00;-"R$" #,##0.00',
  USD: '"US$" #,##0.00;-"US$" #,##0.00',
  EUR: '"€" #,##0.00;-"€" #,##0.00',
};

async function exceljs() {
  const m = await import("exceljs");
  return (m as unknown as { default?: typeof m }).default ?? m;
}

/** "AAAA-MM-DD" → Date em UTC (o exceljs grava datas em UTC; assim o dia não muda). */
function dataUtc(s: string): Date {
  const d = parseData(s);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function gerarExcel(abas: Aba[], moeda: Moeda): Promise<ArrayBuffer> {
  const { Workbook } = await exceljs();
  const wb = new Workbook();
  wb.creator = "Finanças";
  for (const aba of abas) {
    const ws = wb.addWorksheet(aba.nome, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = aba.colunas.map((c) => ({ header: c.titulo, width: c.largura }));
    ws.getRow(1).font = { bold: true };
    for (const linha of aba.linhas) {
      ws.addRow(
        linha.map((v, i) => {
          if (v === null) return null;
          const tipo = aba.colunas[i]!.tipo;
          if (tipo === "moeda") return (v as number) / 100;
          if (tipo === "data") return dataUtc(v as string);
          return v;
        }),
      );
    }
    aba.colunas.forEach((c, i) => {
      const coluna = ws.getColumn(i + 1);
      if (c.tipo === "moeda") coluna.numFmt = FORMATO_MOEDA[moeda];
      if (c.tipo === "data") coluna.numFmt = "dd/mm/yyyy";
    });
    if (aba.linhas.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: aba.colunas.length } };
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
