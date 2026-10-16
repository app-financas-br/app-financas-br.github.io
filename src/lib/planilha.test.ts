/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodificarOfx } from "./ofx";
import {
  aplicarMapeamento,
  dataDaCelula,
  detectarSeparador,
  encontrarCabecalho,
  lerCsv,
  mapeamentoCompleto,
  sugerirMapeamento,
  tipoDoTexto,
  valorDaCelula,
} from "./planilha";

const exemplo = (nome: string) =>
  decodificarOfx(new Uint8Array(readFileSync(new URL(`../features/importacao/__exemplos__/${nome}`, import.meta.url))));

describe("CSV", () => {
  it("detecta o separador fora de aspas", () => {
    expect(detectarSeparador("a;b;c\n1;2;3")).toBe(";");
    expect(detectarSeparador('a,b,c\n"1,5",2,3')).toBe(",");
    expect(detectarSeparador("a\tb\n1\t2")).toBe("\t");
  });

  it("aspas, aspas dobradas, separador e quebra de linha dentro de aspas", () => {
    expect(lerCsv('x;"a;b";"diz ""oi""";"linha\r\nnova"\r\n1;2;3;4', ";")).toEqual([
      ["x", "a;b", 'diz "oi"', "linha\r\nnova"],
      ["1", "2", "3", "4"],
    ]);
  });
});

describe("planilha qualquer: extrato em CSV latin-1 com débito/crédito (anonimizado)", () => {
  const linhas = lerCsv(exemplo("planilha-debito-credito-1252.csv"));
  const cab = encontrarCabecalho(linhas);
  const m = sugerirMapeamento(linhas[cab]!);

  it("acha o cabeçalho abaixo das linhas de título e mapeia as colunas pelo nome", () => {
    expect(cab).toBe(3);
    expect(m).toEqual({ data: 0, debito: 3, credito: 4, descricao: 1 });
    expect(mapeamentoCompleto(m)).toBe(true);
  });

  it("lê as transações com sinal pelo débito/crédito; saldo e total ficam de fora", () => {
    const { transacoes, ignoradas } = aplicarMapeamento(linhas, cab, m);
    expect(transacoes.map((t) => [t.data, t.centavos, t.descricao])).toEqual([
      ["2026-10-03", 125000, "PIX RECEBIDO JOÃO"],
      ["2026-10-04", -18973, "PAGTO BOLETO; ENERGIA"],
      ["2026-10-05", -1250, "COMPRA CARTÃO PADARIA"],
    ]);
    expect(ignoradas).toEqual([5, 10]); // "SALDO ANTERIOR" (sem valor) e "Total" (sem data)
  });
});

describe("mapeamento", () => {
  it("nomes comuns", () => {
    expect(sugerirMapeamento(["Data Lançamento", "Descrição", "Valor (R$)", "Tipo", "Categoria"])).toEqual({
      data: 0, descricao: 1, valor: 2, tipo: 3, categoria: 4,
    });
    expect(sugerirMapeamento(["date", "title", "amount"])).toEqual({ data: 0, descricao: 1, valor: 2 });
    // Só "Saída" (sem crédito nem valor) vira a coluna de valor
    expect(sugerirMapeamento(["Data", "Histórico", "Saída"])).toEqual({ data: 0, descricao: 1, valor: 2 });
  });
  it("incompleto sem data, descrição ou valor", () => {
    expect(mapeamentoCompleto({ data: 0, descricao: 1 })).toBe(false);
    expect(mapeamentoCompleto({ data: 0, descricao: 1, credito: 2 })).toBe(true);
  });
});

describe("datas e valores", () => {
  it("datas em vários formatos, Date do Excel (UTC) e número de série", () => {
    expect(dataDaCelula("16/10/2026")).toBe("2026-10-16");
    expect(dataDaCelula("1/2/26")).toBe("2026-02-01");
    expect(dataDaCelula("16-10-2026")).toBe("2026-10-16");
    expect(dataDaCelula("16.10.2026")).toBe("2026-10-16");
    expect(dataDaCelula("2026-10-16T10:00:00")).toBe("2026-10-16");
    expect(dataDaCelula("16/10/2026 23:59")).toBe("2026-10-16");
    expect(dataDaCelula(new Date(Date.UTC(2026, 9, 16)))).toBe("2026-10-16");
    expect(dataDaCelula(46311)).toBe("2026-10-16");
    expect(dataDaCelula("31/02/2026")).toBeNull();
    expect(dataDaCelula("Total")).toBeNull();
    expect(dataDaCelula(12.5)).toBeNull();
  });

  it("valores: vírgula, milhar, R$, negativo, parênteses, D/C e número", () => {
    expect(valorDaCelula("1.234,56")).toBe(123456);
    expect(valorDaCelula("-52,90")).toBe(-5290);
    expect(valorDaCelula("R$ 10,00")).toBe(1000);
    expect(valorDaCelula("R$ -10,00")).toBe(-1000);
    expect(valorDaCelula("(10,00)")).toBe(-1000);
    expect(valorDaCelula("10,00-")).toBe(-1000);
    expect(valorDaCelula("10,00 D")).toBe(-1000);
    expect(valorDaCelula("10,00 C")).toBe(1000);
    expect(valorDaCelula(245.9)).toBe(24590);
    expect(valorDaCelula(0.1 + 0.2)).toBe(30);
    expect(valorDaCelula("")).toBeNull();
    expect(valorDaCelula("abc")).toBeNull();
  });

  it("tipo pelo texto", () => {
    expect(tipoDoTexto("Entrada")).toBe("entrada");
    expect(tipoDoTexto("Despesa")).toBe("gasto");
    expect(tipoDoTexto("Conta fixa")).toBe("conta_fixa");
    expect(tipoDoTexto("Aplicação")).toBe("investimento");
    expect(tipoDoTexto("Transferência")).toBe("transferencia");
    expect(tipoDoTexto("C")).toBe("entrada");
    expect(tipoDoTexto("D")).toBe("gasto");
    expect(tipoDoTexto("Conta c corrente x")).toBeNull();
    expect(tipoDoTexto("")).toBeNull();
  });
});

describe("coluna Tipo manda no sinal", () => {
  it("planilha com tudo positivo: gasto sai, entrada entra; categoria vem junto", () => {
    const linhas = [
      ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
      ["05/10/2026", "Salário", 3500, "Entrada", ""],
      ["06/10/2026", "Mercado", 245.9, "Gasto", "Alimentação"],
      ["07/10/2026", "Estorno", -30, "Entrada", ""],
      ["08/10/2026", "Sem tipo", -12, "", ""],
      ["09/10/2026", "Aplicação CDB", 500, "Investimento", "Renda fixa"],
      ["10/10/2026", "Resgate CDB", 200, "Investimento", ""],
      ["11/10/2026", "Pix para outra conta", -50, "Transferência", ""],
      ["", "", "", "", ""],
    ];
    const { transacoes, ignoradas } = aplicarMapeamento(linhas, 0, sugerirMapeamento(linhas[0]!));
    expect(transacoes.map((t) => [t.centavos, t.tipo, t.categoria])).toEqual([
      [350000, "entrada", null],
      [-24590, "gasto", "Alimentação"],
      [3000, "entrada", null],
      [-1200, null, null],
      [-50000, "investimento", "Renda fixa"], // aporte sai da conta
      [20000, "investimento", null], // resgate entra
      [-5000, "transferencia", null], // sinal da planilha
    ]);
    expect(ignoradas).toEqual([]); // linha vazia é pulada em silêncio
  });
});
