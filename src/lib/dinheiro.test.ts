import { describe, expect, it } from "vitest";
import { deCentavos, formatarMoeda, formatarPercentual, paraCentavos, parseValor } from "./dinheiro";

// Intl usa espaço não separável entre "R$" e o número
const sem = (s: string) => s.replace(/ /g, " ");

describe("dinheiro", () => {
  it("paraCentavos aceita número ou string do banco", () => {
    expect(paraCentavos("1234.56")).toBe(123456);
    expect(paraCentavos(52.9)).toBe(5290);
    expect(paraCentavos(1.005)).toBe(101); // 1.005 * 100 daria 100.4999… → 100 (errado)
    expect(paraCentavos("0.29")).toBe(29); // 0.29 * 100 = 28.999…
    expect(paraCentavos(null)).toBe(0);
    expect(paraCentavos("abc")).toBe(0);
  });

  it("deCentavos devolve reais", () => {
    expect(deCentavos(123456)).toBe(1234.56);
  });

  it("formata em reais no padrão brasileiro", () => {
    expect(sem(formatarMoeda(123456))).toBe("R$ 1.234,56");
    expect(sem(formatarMoeda(-5000))).toBe("-R$ 50,00");
    expect(sem(formatarMoeda(990, "USD"))).toBe("US$ 9,90");
  });

  it("percentual com sinal", () => {
    expect(formatarPercentual(6.21)).toBe("+6,21%");
    expect(formatarPercentual(-1.08)).toBe("-1,08%");
    expect(formatarPercentual(0)).toBe("0,00%");
  });

  it("parseValor entende o que a pessoa digita", () => {
    expect(parseValor("1.234,56")).toBe(123456);
    expect(parseValor("52,9")).toBe(5290);
    expect(parseValor("R$ 10")).toBe(1000);
    expect(parseValor("1.234")).toBe(123400);
    expect(parseValor("1234.5")).toBe(123450);
    expect(parseValor("-30,00")).toBe(-3000);
    expect(parseValor("")).toBeNull();
    expect(parseValor("abc")).toBeNull();
    expect(parseValor("1,2,3")).toBeNull();
  });
});
