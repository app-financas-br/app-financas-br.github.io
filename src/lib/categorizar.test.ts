import { describe, expect, it } from "vitest";
import { categorizar, normalizar, type CategoriaParaCasar } from "./categorizar";

const categorias: CategoriaParaCasar[] = [
  { id: "ali", nome: "Alimentação", palavras: ["mercado", "pao de acucar", "acai", "cafe"], ordem: 1 },
  { id: "casa", nome: "Casa", palavras: ["agua", "luz", "aluguel"], ordem: 2 },
  { id: "tra", nome: "Transporte", palavras: ["uber", "99", "gasolina"], ordem: 5 },
  { id: "doce", nome: "Doces", palavras: ["acucar"], ordem: 6 },
  { id: "out", nome: "Outros", palavras: [], ordem: 99 },
  { id: "velha", nome: "Antiga", palavras: ["netflix"], oculta: true, ordem: 7 },
];

describe("normalizar", () => {
  it("tira acento, caixa e pontuação", () => {
    expect(normalizar("  Açaí  da PRAÇA!! ")).toBe("acai da praca");
    expect(normalizar("Pão-de-Açúcar")).toBe("pao de acucar");
  });
});

describe("categorizar", () => {
  const ctx = { categorias, regras: [] };

  it("casa palavra inteira, sem acento", () => {
    expect(categorizar("Açaí da praça", ctx)).toBe("ali");
    expect(categorizar("Conta de LUZ", ctx)).toBe("casa");
    expect(categorizar("Corrida 99", ctx)).toBe("tra");
  });

  it("não casa pedaço de palavra", () => {
    expect(categorizar("Supermercadão", ctx)).toBe("out"); // "mercado" não é palavra inteira aqui
    expect(categorizar("Lucro", ctx)).toBe("out"); // contém "luz"? não; e "uber" não está em "lucro"
    expect(categorizar("1999", ctx)).toBe("out"); // "99" dentro de "1999" não conta
  });

  it("expressão mais longa vence ('pao de acucar' ganha de 'acucar')", () => {
    expect(categorizar("Pão de Açúcar", ctx)).toBe("ali");
  });

  it("sem casamento → Outros", () => {
    expect(categorizar("Presente da Ana", ctx)).toBe("out");
    expect(categorizar("", ctx)).toBe("out");
  });

  it("categoria oculta não é usada", () => {
    expect(categorizar("Netflix", ctx)).toBe("out");
  });

  it("prioridade: categoria gravada → regra manual → palavras-chave", () => {
    const regras = [{ termo: "uber", categoria_id: "casa" }];
    expect(categorizar("Uber", { categorias, regras })).toBe("casa");
    expect(categorizar("Uber", { categorias, regras, categoriaIdAtual: "ali" })).toBe("ali");
    expect(categorizar("Uber do trabalho", { categorias, regras })).toBe("tra"); // regra é para o nome exato
  });

  it("regra ou categoria gravada apontando para categoria oculta é ignorada", () => {
    expect(categorizar("Uber", { categorias, regras: [{ termo: "uber", categoria_id: "velha" }], categoriaIdAtual: "velha" })).toBe("tra");
  });
});
