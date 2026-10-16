import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RascunhoData, dataValida } from "./rascunhoData";

/**
 * Sequência que o <input type="date"> do Chrome (pt-BR, dd/mm/aaaa) emite ao digitar
 * "31/10/2026" pelo teclado num campo que estava em 16/10/2026.
 * Dia: "3" → 03, "1" → 31. Mês: "1" → 01, "0" → 10. Ano: 0002 → 0020 → 0202 → 2026.
 */
const DIGITANDO_31_10_2026 = [
  "2026-10-03",
  "2026-10-31",
  "2026-01-31",
  "2026-10-31",
  "0002-10-31",
  "0020-10-31",
  "0202-10-31",
  "2026-10-31",
];

describe("dataValida", () => {
  it("aceita só datas completas, reais e entre 2000 e 2100", () => {
    expect(dataValida("2026-10-31")).toBe(true);
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("2026-02-30")).toBe(false);
    expect(dataValida("0202-10-31")).toBe(false);
    expect(dataValida("2026-10-3")).toBe(false);
    expect(dataValida("")).toBe(false);
  });
});

describe("RascunhoData (campo de data)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("digitando 31/10/2026 em ritmo normal: salva uma vez só, 2026-10-31 (nunca 01)", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    for (const v of DIGITANDO_31_10_2026) {
      c.alterar(v);
      vi.advanceTimersByTime(150); // ~150 ms entre teclas
    }
    vi.advanceTimersByTime(800);
    expect(salvar).toHaveBeenCalledTimes(1);
    expect(salvar).toHaveBeenCalledWith("2026-10-31");
    expect(c.rascunho).toBe("2026-10-31");
  });

  it("o valor que volta do banco no meio da digitação NÃO apaga o que está sendo digitado", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.alterar("2026-10-03");
    vi.advanceTimersByTime(900); // pausa longa depois do "3": salva 03…
    c.sincronizar("2026-10-03"); // …o banco devolve 03 (era aqui que o "1" virava "01")
    c.alterar("2026-10-31");
    expect(c.rascunho).toBe("2026-10-31");
    c.sair();
    expect(salvar).toHaveBeenLastCalledWith("2026-10-31");
    expect(salvar.mock.calls.flat()).not.toContain("2026-10-01");
  });

  it("ao sair do campo salva na hora, sem esperar", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.alterar("2026-10-31");
    c.sair();
    expect(salvar).toHaveBeenCalledWith("2026-10-31");
  });

  it("ano incompleto não é salvo; ao sair, volta ao último valor salvo", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.alterar("0202-10-16");
    vi.advanceTimersByTime(2000);
    c.sair();
    expect(salvar).not.toHaveBeenCalled();
    expect(c.rascunho).toBe("2026-10-16");
  });

  it("apagar a data e sair limpa o campo (null)", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.alterar("");
    vi.advanceTimersByTime(2000);
    expect(salvar).not.toHaveBeenCalled();
    c.sair();
    expect(salvar).toHaveBeenCalledWith(null);
  });

  it("sem mudança não salva; fora de edição aceita o valor do banco", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.sair();
    expect(salvar).not.toHaveBeenCalled();
    c.sincronizar("2026-11-01");
    expect(c.rascunho).toBe("2026-11-01");
  });

  it("se a linha sai da tela com data pendente, salva antes", () => {
    const salvar = vi.fn();
    const c = new RascunhoData("2026-10-16", salvar);
    c.focar();
    c.alterar("2026-10-31");
    c.encerrar();
    expect(salvar).toHaveBeenCalledWith("2026-10-31");
  });
});
