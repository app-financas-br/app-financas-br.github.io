import { describe, expect, it } from "vitest";
import { chaveNome, corLivre, nomeLivre, nomeRepetido, PALETA_CATEGORIAS } from "./regrasCategoria";

const existentes = [
  { id: "1", nome: "Casa" },
  { id: "2", nome: "Saúde" },
  { id: "3", nome: "Alimentação" },
];

describe("nome repetido (ignora maiúsculas, acentos e pontuação)", () => {
  it("'casa', 'CASA' e ' Casa! ' colidem com 'Casa'", () => {
    for (const n of ["casa", "CASA", " Casa! "]) expect(nomeRepetido(n, existentes)).toBe(true);
  });

  it("'Saude' (sem acento) colide com 'Saúde'; 'alimentacao' com 'Alimentação'", () => {
    expect(nomeRepetido("Saude", existentes)).toBe(true);
    expect(nomeRepetido("alimentacao", existentes)).toBe(true);
  });

  it("nome novo de verdade passa", () => {
    expect(nomeRepetido("Pets", existentes)).toBe(false);
  });

  it("renomear para o próprio nome (mudando só a caixa) não conta como repetido", () => {
    expect(nomeRepetido("CASA", existentes, "1")).toBe(false);
  });

  it("chave igual à regra do banco: lower + sem acento + só letras/números", () => {
    expect(chaveNome("  Ações e FIIs ")).toBe("acoes e fiis");
  });
});

describe("nomeLivre", () => {
  it("numera sem diferenciar caixa e acento", () => {
    expect(nomeLivre("Nova categoria", ["Casa"])).toBe("Nova categoria");
    expect(nomeLivre("Nova categoria", ["nova categoria", "NOVA CATEGORIA 2"])).toBe("Nova categoria 3");
  });
});

describe("corLivre", () => {
  it("escolhe uma cor que nenhuma outra categoria usa (sem diferenciar caixa)", () => {
    const usadas = ["#2AFFBD", "#ffa31c", "#2f8fe8"];
    const cor = corLivre(usadas);
    expect(usadas.map((c) => c.toLowerCase())).not.toContain(cor);
    expect(cor).toBe("#a26ad5");
  });

  it("com a paleta toda usada, gera uma cor nova válida e diferente", () => {
    const cor = corLivre(PALETA_CATEGORIAS);
    expect(cor).toMatch(/^#[0-9a-f]{6}$/);
    expect(PALETA_CATEGORIAS).not.toContain(cor);
  });

  it("criar várias seguidas nunca repete cor", () => {
    const usadas: string[] = ["#f97316", "#22d3ee", "#2affbd", "#a26ad5", "#2f8fe8", "#64748b"]; // padrões de gasto
    for (let i = 0; i < 20; i++) {
      const cor = corLivre(usadas);
      expect(usadas).not.toContain(cor);
      usadas.push(cor);
    }
  });
});
