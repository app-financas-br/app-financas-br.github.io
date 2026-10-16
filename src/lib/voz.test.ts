import { describe, expect, it } from "vitest";
import { itensParaLinhas, montarInsercao, totalPrevisto, type ItemVoz } from "./voz";

const categorias = [
  { id: "alim", nome: "Alimentação", tipo: "gasto" as const },
  { id: "transp", nome: "Transporte", tipo: "gasto" as const },
  { id: "casa", nome: "Casa", tipo: "gasto" as const },
  { id: "rf", nome: "Renda fixa", tipo: "investimento" as const },
];
const out = { ano: 2026, mes: 10 };
const agora = new Date(2026, 9, 16, 23, 30); // 23h30 em SP: continua dia 16

// Resposta do exemplo de aceite: "gastei 52 e 90 no mercado no débito e 30 de uber"
const exemplo: ItemVoz[] = [
  { tipo: "gasto", descricao: "Mercado", valor: 52.9, categoria: "Alimentação", parcelas: 1, forma_pagamento: "debito", data: null },
  { tipo: "gasto", descricao: "Uber", valor: 30, categoria: "Transporte", parcelas: 1, forma_pagamento: "nao_informado", data: null },
];

describe("itensParaLinhas", () => {
  it("2 itens do exemplo de aceite, com categoria por nome e data de hoje no fuso local", () => {
    const l = itensParaLinhas(exemplo, categorias, out, agora);
    expect(l.map((x) => [x.tipo, x.descricao, x.centavos, x.categoriaId, x.forma, x.data])).toEqual([
      ["gasto", "Mercado", 5290, "alim", "debito", "2026-10-16"],
      ["gasto", "Uber", 3000, "transp", "nao_informado", "2026-10-16"],
    ]);
  });

  it("'recebi 3 mil de salário' vira uma entrada sem categoria", () => {
    const [e] = itensParaLinhas(
      [{ tipo: "entrada", descricao: "Salário", valor: 3000, categoria: "Alimentação", parcelas: 1, forma_pagamento: "nao_informado", data: null }],
      categorias,
      out,
      agora,
    );
    expect(e).toMatchObject({ tipo: "entrada", centavos: 300000, categoriaId: null });
  });

  it("resgate (negativo), categoria desconhecida, data falada e parcelas fora do limite", () => {
    const [r, g] = itensParaLinhas(
      [
        { tipo: "investimento", descricao: "Resgate CDB", valor: -200, categoria: "Renda fixa", parcelas: 1, forma_pagamento: "nao_informado", data: null },
        { tipo: "gasto", descricao: "Loja", valor: 600, categoria: "Inexistente", parcelas: 40, forma_pagamento: "credito", data: "2026-10-05" },
      ],
      categorias,
      out,
      agora,
    );
    expect(r).toMatchObject({ centavos: 20000, resgate: true, categoriaId: "rf" });
    expect(g).toMatchObject({ categoriaId: null, parcelas: 12, data: "2026-10-05" });
  });

  it("navegando em outro mês, o padrão é o dia 1 daquele mês", () => {
    expect(itensParaLinhas(exemplo, categorias, { ano: 2026, mes: 8 }, agora)[0]!.data).toBe("2026-08-01");
  });
});

describe("total previsto", () => {
  it("gastos subtraem; entrada e resgate somam", () => {
    const l = itensParaLinhas(exemplo, categorias, out, agora);
    expect(totalPrevisto(l)).toBe(-8290); // − R$ 82,90
    expect(totalPrevisto([...l, { ...l[0]!, tipo: "entrada", centavos: 10000 }])).toBe(1710);
  });
});

describe("montarInsercao", () => {
  const [mercado, uber] = itensParaLinhas(exemplo, categorias, out, agora);
  it("gasto no débito no mês selecionado com origem voz; pagamento não dito vira Pix", () => {
    expect(montarInsercao(mercado!, out)).toEqual({
      tabela: "gastos_variaveis",
      parcelas: 1,
      valores: { descricao: "Mercado", ano: 2026, mes: 10, origem: "voz", valor: 52.9, pago: true, forma_pagamento: "debito", data: "2026-10-16", categoria_id: "alim" },
    });
    expect(montarInsercao(uber!, out).valores.forma_pagamento).toBe("pix");
  });

  it("crédito com cartão: liga ao cartão e vai para o mês da fatura", () => {
    const l = { ...mercado!, forma: "credito" as const, parcelas: 3 };
    const ins = montarInsercao(l, out, { id: "nu", nome: "Cartão Nubank", regra: { diaFechamento: 28, diaVencimento: 5, compraNoFechamentoProxima: true } });
    expect(ins).toMatchObject({ tabela: "gastos_variaveis", parcelas: 3 });
    expect(ins.valores).toMatchObject({ conta_bancaria_id: "nu", cartao: "Cartão Nubank", ano: 2026, mes: 11, data: "2026-10-16" });
    // Cartão sem fechamento/vencimento: fica no mês selecionado
    expect(montarInsercao(l, out, { id: "x", nome: "X", regra: null }).valores).toMatchObject({ ano: 2026, mes: 10, conta_bancaria_id: "x" });
  });

  it("crédito com mês escolhido no painel: vale a escolha, não a sugestão do cartão", () => {
    const l = { ...mercado!, forma: "credito" as const, fatura: { ano: 2026, mes: 10 } };
    const cartao = { id: "nu", nome: "Nu", regra: { diaFechamento: 28, diaVencimento: 5, compraNoFechamentoProxima: true } };
    expect(montarInsercao(l, out, cartao).valores).toMatchObject({ ano: 2026, mes: 10, data: "2026-10-16" });
    // Sem cartão cadastrado: começa no mês da compra
    expect(montarInsercao({ ...mercado!, forma: "credito", data: "2026-09-30" }, out).valores).toMatchObject({ ano: 2026, mes: 9 });
  });

  it("entrada recebida, conta fixa pendente com vencimento, resgate negativo", () => {
    const base = itensParaLinhas(exemplo, categorias, out, agora)[0]!;
    expect(montarInsercao({ ...base, tipo: "entrada" }, out)).toMatchObject({ tabela: "entradas", valores: { recebido: true, valor: 52.9 } });
    expect(montarInsercao({ ...base, tipo: "conta_fixa" }, out)).toMatchObject({ tabela: "contas_fixas", valores: { pago: false, vencimento: "2026-10-16" } });
    expect(montarInsercao({ ...base, tipo: "investimento", resgate: true }, out).valores).toMatchObject({ valor: -52.9 });
  });
});
