// Planilhas .xlsx com exceljs, carregado só quando a pessoa usa (não pesa no carregamento do app).

import type { Celula } from "../../lib/planilha";
import { MODELO } from "../../lib/planilha";

async function exceljs() {
  const m = await import("exceljs");
  return (m as unknown as { default?: typeof m }).default ?? m;
}

/** Valor de célula do exceljs → Celula (texto, número ou Date). */
function celula(v: unknown): Celula {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) return v;
  if (typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown; error?: unknown };
    if ("result" in o) return celula(o.result); // fórmula: usa o resultado
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if ("text" in o) return celula(o.text); // hyperlink
    if ("error" in o) return null;
  }
  return null;
}

/** Primeira aba da planilha → linhas de células. */
export async function lerXlsx(bytes: ArrayBuffer): Promise<Celula[][]> {
  const { Workbook } = await exceljs();
  const wb = new Workbook();
  await wb.xlsx.load(bytes);
  const aba = wb.worksheets[0];
  if (!aba) return [];
  const linhas: Celula[][] = [];
  aba.eachRow({ includeEmpty: true }, (row, n) => {
    const valores = (row.values as unknown[]).slice(1); // values[0] é sempre vazio
    linhas[n - 1] = valores.map(celula);
  });
  return Array.from(linhas, (l) => l ?? []);
}

/** "05/10/2026" → Date em UTC (o exceljs grava e lê datas em UTC). */
const dataUtc = (dmy: string) => {
  const [d, m, a] = dmy.split("/").map(Number);
  return new Date(Date.UTC(a!, m! - 1, d!));
};

/**
 * Modelo do app. Aba "Lançamentos" só com o cabeçalho (é a que o app lê);
 * os exemplos ficam na aba "Como preencher", para nunca serem importados por engano.
 */
export async function gerarModeloXlsx(): Promise<ArrayBuffer> {
  const { Workbook } = await exceljs();
  const wb = new Workbook();
  const colunas = [
    { header: MODELO.cabecalho[0], width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: MODELO.cabecalho[1], width: 36 },
    { header: MODELO.cabecalho[2], width: 14, style: { numFmt: "#,##0.00" } },
    { header: MODELO.cabecalho[3], width: 16 },
    { header: MODELO.cabecalho[4], width: 18 },
  ];

  const aba = wb.addWorksheet("Lançamentos");
  aba.columns = colunas;
  aba.getRow(1).font = { bold: true };
  for (let r = 2; r <= 1000; r++) {
    aba.getCell(`D${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${MODELO.tipos.join(",")}"`] };
  }
  aba.views = [{ state: "frozen", ySplit: 1 }];

  const ajuda = wb.addWorksheet("Como preencher");
  ajuda.columns = colunas;
  ajuda.getRow(1).font = { bold: true };
  for (const e of MODELO.exemplos) ajuda.addRow([dataUtc(String(e[0])), ...e.slice(1)]);
  ajuda.addRow([]);
  [
    "Preencha a aba Lançamentos (a primeira). Esta aba é só exemplo e não é importada.",
    "Data: dd/mm/aaaa. Valor: em reais (1234,56).",
    "Tipo: Entrada, Gasto, Conta fixa, Investimento ou Transferência. Com Tipo, o valor pode ser sempre positivo (Investimento = aporte; escreva \"resgate\" na descrição para resgate). Sem Tipo, e em Transferência, valor negativo = saiu da conta.",
    "Categoria: opcional, o nome de uma categoria do app. Vazia = categoria automática.",
  ].forEach((linha) => ajuda.addRow([linha]));

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
