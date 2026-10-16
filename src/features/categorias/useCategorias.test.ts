import { describe, expect, it, vi } from "vitest";

// O módulo importa o cliente Supabase, que exige as variáveis de ambiente; aqui só testamos a função pura.
vi.mock("../../lib/supabase", () => ({ supabase: {} }));
const { ehCategoriaReserva } = await import("./useCategorias");

describe("ehCategoriaReserva", () => {
  it("só a 'Outros' padrão de gasto (ordem 99) é reserva, mesmo se o nome mudar", () => {
    expect(ehCategoriaReserva({ tipo: "gasto", padrao: true, ordem: 99 })).toBe(true);
    expect(ehCategoriaReserva({ tipo: "gasto", padrao: true, ordem: 1 })).toBe(false); // Alimentação
    expect(ehCategoriaReserva({ tipo: "gasto", padrao: false, ordem: 99 })).toBe(false); // criada pela pessoa
    expect(ehCategoriaReserva({ tipo: "investimento", padrao: true, ordem: 99 })).toBe(false);
  });
});
