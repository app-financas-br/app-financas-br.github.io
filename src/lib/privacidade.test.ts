import { afterEach, describe, expect, it, vi } from "vitest";

/** localStorage de mentira (o ambiente de teste é node). */
function armazenamento() {
  const dados = new Map<string, string>();
  return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, String(v)), dados };
}

/** Carrega os módulos do zero, como num recarregamento da página. */
async function carregar() {
  vi.resetModules();
  const privacidade = await import("./privacidade");
  const dinheiro = await import("./dinheiro");
  return { ...privacidade, ...dinheiro };
}

afterEach(() => vi.unstubAllGlobals());

describe("olhinho: ocultar valores em dinheiro", () => {
  it("primeira vez: valores visíveis", async () => {
    vi.stubGlobal("localStorage", armazenamento());
    const m = await carregar();
    expect(m.valoresOcultos()).toBe(false);
    expect(m.formatarMoeda(123456)).toMatch(/^R\$\s1\.234,56$/);
  });

  it("ocultar e mostrar: moeda, movimento e eixo compacto; porcentagem continua", async () => {
    vi.stubGlobal("localStorage", armazenamento());
    const m = await carregar();
    m.definirValoresOcultos(true);
    expect(m.formatarMoeda(123456)).toBe("R$ ••••");
    expect(m.formatarMoeda(500, "USD")).toBe("US$ ••••");
    expect(m.formatarMoeda(500, "EUR")).toBe("€ ••••");
    expect(m.formatarMovimento(-5290)).toBe("R$ ••••"); // sem sinal
    expect(m.formatarMovimento(0)).toBe("R$ ••••");
    expect(m.formatarCompacto(120000000)).toBe("••••");
    expect(m.formatarPercentual(6.21)).toBe("+6,21%");
    m.definirValoresOcultos(false);
    expect(m.formatarMovimento(-5290)).toMatch(/^−R\$\s52,90$/);
    expect(m.formatarCompacto(120000000)).toMatch(/^1,2\smi$/);
  });

  it("lembra a escolha depois de recarregar", async () => {
    const guardado = armazenamento();
    vi.stubGlobal("localStorage", guardado);
    (await carregar()).definirValoresOcultos(true);
    expect(guardado.dados.get("financas:ocultar-valores")).toBe("1");
    const recarregado = await carregar();
    expect(recarregado.valoresOcultos()).toBe(true);
    expect(recarregado.formatarMoeda(100)).toBe("R$ ••••");
    recarregado.definirValoresOcultos(false);
    expect((await carregar()).valoresOcultos()).toBe(false);
  });

  it("sem localStorage (aba privada): mostra os valores e não quebra", async () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } });
    const m = await carregar();
    expect(m.valoresOcultos()).toBe(false);
    expect(() => m.definirValoresOcultos(true)).not.toThrow();
    expect(m.formatarMoeda(100)).toBe("R$ ••••");
  });

  it("detector de vazamento acha 'R$ <número>' e aceita o texto oculto", async () => {
    const { PADRAO_VALOR_VISIVEL } = await carregar();
    for (const vazou of ["R$ 1.234,56", "−R$ 52,90", "R$12", "US$ 3,00", "€ 1,00", "Saldo: R$ 0,00"]) expect(PADRAO_VALOR_VISIVEL.test(vazou)).toBe(true);
    for (const ok of ["R$ ••••", "US$ ••••", "45%", "17/10/2026", "••••"]) expect(PADRAO_VALOR_VISIVEL.test(ok)).toBe(false);
  });
});
