import { describe, expect, it } from "vitest";
import { camposDetalhes, MAX_OBSERVACAO } from "./DetalhesGasto";

describe("camposDetalhes", () => {
  it("guarda o cartão em crédito/débito, sem espaços sobrando", () => {
    expect(camposDetalhes({ forma_pagamento: "credito" }, "  Nubank ", " parcela da TV ")).toEqual({
      cartao: "Nubank",
      observacao: "parcela da TV",
    });
  });

  it("em Pix ou dinheiro o cartão vai como null", () => {
    expect(camposDetalhes({ forma_pagamento: "pix" }, "Nubank", "")).toEqual({ cartao: null, observacao: null });
  });

  it("vazio vira null e a observação é limitada", () => {
    const longa = "x".repeat(MAX_OBSERVACAO + 50);
    expect(camposDetalhes({ forma_pagamento: "debito" }, "   ", longa)).toEqual({
      cartao: null,
      observacao: "x".repeat(MAX_OBSERVACAO),
    });
  });
});
