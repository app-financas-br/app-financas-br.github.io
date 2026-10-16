import { describe, expect, it } from "vitest";
import { dataPadrao, formatarData, hoje, mesAnterior, parseData, periodoAtual, proximoMes, ultimoDiaDoMes } from "./datas";

describe("datas", () => {
  it("hoje usa o fuso local, mesmo às 23h30", () => {
    expect(hoje(new Date(2026, 9, 16, 23, 30))).toBe("2026-10-16");
    expect(hoje(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });

  it("parseData não desloca o dia (sem UTC)", () => {
    const d = parseData("2026-03-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1]);
    expect(formatarData(d)).toBe("2026-03-01");
  });

  it("parseData recusa datas inexistentes ou mal formatadas", () => {
    expect(() => parseData("2026-02-30")).toThrow();
    expect(() => parseData("16/10/2026")).toThrow();
  });

  it("último dia do mês considera ano bissexto", () => {
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });

  it("próximo mês e mês anterior atravessam o ano", () => {
    expect(proximoMes({ ano: 2026, mes: 12 })).toEqual({ ano: 2027, mes: 1 });
    expect(proximoMes({ ano: 2026, mes: 5 })).toEqual({ ano: 2026, mes: 6 });
    expect(mesAnterior({ ano: 2026, mes: 1 })).toEqual({ ano: 2025, mes: 12 });
    expect(mesAnterior({ ano: 2026, mes: 7 })).toEqual({ ano: 2026, mes: 6 });
  });

  it("data padrão: hoje no mês atual, dia 1 em outros meses", () => {
    const agora = new Date(2026, 9, 16, 23, 30);
    expect(dataPadrao({ ano: 2026, mes: 10 }, agora)).toBe("2026-10-16");
    expect(dataPadrao({ ano: 2027, mes: 1 }, agora)).toBe("2027-01-01");
  });

  it("período atual tem mês de 1 a 12", () => {
    expect(periodoAtual(new Date(2026, 11, 31, 23, 59))).toEqual({ ano: 2026, mes: 12 });
  });
});
