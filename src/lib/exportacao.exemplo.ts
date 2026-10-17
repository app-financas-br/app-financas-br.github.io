// Dados de exemplo para os testes da exportação (lib e gravação do .xlsx).
import type { DadosExportacao } from "./exportacao";
import type { ContaFixa, Entrada, Gasto, Investimento } from "../features/lancamentos/tipos";

const base = { origem: "manual", created_at: "" };
const parc = { grupo_parcela: null, parcela_num: null, parcela_total: null };
const gasto = (id: string, ano: number, mes: number, data: string, valor: number | string, extra: Partial<Gasto> = {}): Gasto => ({
  ...base, ...parc, id, ano, mes, descricao: `Gasto ${id}`, valor, pago: true, forma_pagamento: "pix", cartao: null,
  data, categoria_id: "alim", observacao: null, ...extra,
});

export const dados: DadosExportacao = {
  entradas: [{ ...base, id: "e1", ano: 2026, mes: 10, descricao: "Salário", valor: "3000.00", recebido: true, data: "2026-10-05" } as Entrada],
  contasFixas: [{ ...base, ...parc, id: "c1", ano: 2026, mes: 10, descricao: "Aluguel", valor: 1200, pago: false, vencimento: "2026-10-10", categoria_id: "casa" } as ContaFixa],
  gastos: [
    gasto("g2", 2026, 11, "2026-10-10", 83.33, { forma_pagamento: "credito", conta_bancaria_id: "nu", parcela_num: 2, parcela_total: 3 }),
    gasto("g1", 2026, 10, "2026-10-16", 52.9),
    gasto("g0", 2026, 1, "2026-01-31", 10),
    gasto("x", 2025, 10, "2025-10-01", 999), // outro ano: nunca entra
  ],
  investimentos: [{ ...base, id: "i1", ano: 2026, mes: 10, descricao: "Resgate CDB", valor: -200, data: "2026-10-20", categoria_id: "rf", destino: null } as Investimento],
  categorias: [{ id: "alim", nome: "Alimentação" }, { id: "casa", nome: "Casa" }, { id: "rf", nome: "Renda fixa" }],
  contasBancarias: [{ id: "nu", nome: "Cartão Nubank" }],
};
