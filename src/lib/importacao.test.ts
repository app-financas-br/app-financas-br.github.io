/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodificarOfx, lerOfx } from "./ofx";
import { paraCentavos } from "./dinheiro";
import {
  chavesDasLinhas,
  contaFixaParecida,
  detectarTransferencias,
  nomeDoBanco,
  sugerirTipo,
  valorParaTipo,
  type LinhaParaPar,
} from "./importacao";

const exemplo = (nome: string) =>
  lerOfx(decodificarOfx(new Uint8Array(readFileSync(new URL(`../features/importacao/__exemplos__/${nome}`, import.meta.url)))));

describe("chaves (sem duplicar)", () => {
  it("OFX usa o FITID; reimportar o mesmo arquivo gera as mesmas chaves", async () => {
    const e = exemplo("nubank-conta-sgml-1252.ofx");
    const a = await chavesDasLinhas("conta-nu", e.transacoes);
    const b = await chavesDasLinhas("conta-nu", exemplo("nubank-conta-sgml-1252.ofx").transacoes);
    expect(a[0]).toBe("ofx:EXEMPLO-NU-0001");
    expect(b).toEqual(a);
    // Com as chaves já gravadas, tudo é pulado
    const existentes = new Set(a);
    expect(b.filter((c) => !existentes.has(c))).toEqual([]);
  });

  it("sem FITID usa hash; dois lançamentos idênticos no mesmo arquivo continuam dois", async () => {
    const cafe = { data: "2026-10-14", centavos: -650, descricao: "Café", fitid: null };
    const [c1, c2, c3] = await chavesDasLinhas("conta-x", [cafe, { ...cafe, descricao: "  CAFÉ " }, { ...cafe, centavos: -700 }]);
    expect(c1).toMatch(/^h:[0-9a-f]{64}$/);
    expect(c2).toBe(`${c1}#2`); // mesma descrição normalizada
    expect(c3).not.toBe(c1);
    // Outra conta, mesma linha: chave diferente
    expect((await chavesDasLinhas("conta-y", [cafe]))[0]).not.toBe(c1);
  });

  it("FITID repetido no arquivo também ganha #2", async () => {
    const l = { data: "2026-10-01", centavos: -1, descricao: "a", fitid: "X" };
    expect(await chavesDasLinhas("c", [l, { ...l, descricao: "b" }])).toEqual(["ofx:X", "ofx:X#2"]);
  });
});

describe("tipo sugerido", () => {
  it("crédito → entrada, débito → gasto, aplicação/resgate → investimento", () => {
    expect(sugerirTipo({ centavos: 100, descricao: "Pix recebido" })).toBe("entrada");
    expect(sugerirTipo({ centavos: -100, descricao: "Padaria" })).toBe("gasto");
    expect(sugerirTipo({ centavos: -100000, descricao: "Aplicação RDB" })).toBe("investimento");
    expect(sugerirTipo({ centavos: 50000, descricao: "RESGATE CDB" })).toBe("investimento");
  });
  it("valor gravado: aporte positivo, resgate negativo, demais sempre positivos", () => {
    expect(valorParaTipo("investimento", -100000)).toBe(100000);
    expect(valorParaTipo("investimento", 50000)).toBe(-50000);
    expect(valorParaTipo("gasto", -1850)).toBe(1850);
    expect(valorParaTipo("entrada", 1850)).toBe(1850);
  });
  it("nome do banco pelo código do OFX", () => {
    expect(nomeDoBanco("0260")).toBe("Nubank");
    expect(nomeDoBanco("077")).toBe("Inter");
    expect(nomeDoBanco("999")).toBeNull();
  });
});

describe("conta fixa parecida", () => {
  const contas = [
    { id: "net", descricao: "Internet", valor: "89.90", pago: false, ano: 2026, mes: 10 },
    { id: "luz", descricao: "Luz", valor: 120, pago: true, ano: 2026, mes: 10 },
  ];
  it("débito com mesmo valor e nome de conta fixa não paga do mês", () => {
    const l = { data: "2026-10-13", centavos: -8990, descricao: "Internet Fibra Exemplo", fitid: null };
    expect(contaFixaParecida(l, contas, paraCentavos)?.id).toBe("net");
    expect(contaFixaParecida({ ...l, centavos: -8991 }, contas, paraCentavos)).toBeNull();
    expect(contaFixaParecida({ ...l, data: "2026-11-13" }, contas, paraCentavos)).toBeNull();
    expect(contaFixaParecida({ ...l, descricao: "Luz", centavos: -12000 }, contas, paraCentavos)).toBeNull(); // já paga
  });
});

describe("transferências entre minhas contas", () => {
  it("par entre dois arquivos de bancos diferentes (Nubank → Inter)", async () => {
    const nu = exemplo("nubank-conta-sgml-1252.ofx").transacoes.map((t, i) => ({ id: `nu${i}`, contaId: "nu", ...t }));
    const inter = exemplo("inter-conta-xml-utf8.ofx").transacoes.map((t, i) => ({ id: `in${i}`, contaId: "inter", ...t }));
    const r = detectarTransferencias([...nu, ...inter], [], []);
    expect(r.get("nu3")).toEqual({ tipo: "lote", parId: "in0", outraContaId: "inter" });
    expect(r.get("in0")).toEqual({ tipo: "lote", parId: "nu3", outraContaId: "nu" });
    expect(r.size).toBe(2);
  });

  const saida: LinhaParaPar = { id: "a", contaId: "nu", data: "2026-10-10", centavos: -50000 };
  it("3 dias de diferença ou mesma conta não casam", () => {
    expect(detectarTransferencias([saida, { id: "b", contaId: "inter", data: "2026-10-13", centavos: 50000 }], [], []).size).toBe(0);
    expect(detectarTransferencias([saida, { id: "b", contaId: "nu", data: "2026-10-10", centavos: 50000 }], [], []).size).toBe(0);
    expect(detectarTransferencias([saida, { id: "b", contaId: "inter", data: "2026-10-10", centavos: 49999 }], [], []).size).toBe(0);
  });

  it("casa com a data mais próxima e cada ponta uma vez só", () => {
    const r = detectarTransferencias(
      [saida, { id: "longe", contaId: "inter", data: "2026-10-12", centavos: 50000 }, { id: "perto", contaId: "c6", data: "2026-10-10", centavos: 50000 }],
      [],
      [],
    );
    expect(r.get("a")).toMatchObject({ parId: "perto" });
    expect(r.has("longe")).toBe(false);
  });

  it("outra ponta já gravada (importada de outra conta) vira conversão", () => {
    const gravado = { id: "g1", tabela: "entradas" as const, contaId: "inter", data: "2026-10-11", centavos: 50000, descricao: "PIX RECEBIDO" };
    const r = detectarTransferencias([saida], [gravado], []);
    expect(r.get("a")).toEqual({ tipo: "gravado", par: gravado, outraContaId: "inter" });
  });

  it("transferência já registrada: a linha é marcada e não casa de novo", () => {
    const t = { contaOrigemId: "nu", contaDestinoId: "inter", data: "2026-10-10", centavos: 50000 };
    expect(detectarTransferencias([saida], [], [t]).get("a")).toEqual({ tipo: "ja_registrada" });
    // A ponta de entrada no Inter também reconhece a mesma transferência
    expect(detectarTransferencias([{ id: "b", contaId: "inter", data: "2026-10-11", centavos: 50000 }], [], [t]).get("b")).toEqual({ tipo: "ja_registrada" });
    // Mas não o sentido contrário
    expect(detectarTransferencias([{ id: "c", contaId: "nu", data: "2026-10-10", centavos: 50000 }], [], [t]).size).toBe(0);
  });
});
