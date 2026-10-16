// Lançamento por voz (docs/03-voz.md): resposta da função "voz" → linhas editáveis →
// registros para gravar. Puro e testado; a gravação fica em features/voz.

import { normalizar } from "./categorizar";
import { dataPadrao, type Periodo } from "./datas";
import { deCentavos, paraCentavos } from "./dinheiro";
import { sugerirFatura, type RegraCartao } from "./fatura";

export type TipoVoz = "gasto" | "entrada" | "investimento" | "conta_fixa";
export type FormaVoz = "pix" | "debito" | "credito" | "dinheiro" | "nao_informado";

/** Item como a função devolve (valor em reais; investimento negativo = resgate). */
export type ItemVoz = {
  tipo: TipoVoz;
  descricao: string;
  valor: number;
  categoria: string | null;
  parcelas: number;
  forma_pagamento: FormaVoz;
  data: string | null;
};

/** Linha do painel de confirmação (valor em centavos, sempre positivo; `resgate` para investimento). */
export type LinhaVoz = {
  id: string;
  tipo: TipoVoz;
  descricao: string;
  centavos: number;
  resgate: boolean;
  categoriaId: string | null;
  /** Categoria que a IA sugeriu (para gravar regra quando a pessoa trocar). */
  categoriaSugerida: string | null;
  parcelas: number;
  forma: FormaVoz;
  data: string;
  /** Cartão escolhido quando a forma é crédito. */
  cartaoId: string | null;
  /** Crédito: mês da fatura escolhido no painel; ausente = a sugestão (regra do cartão ou mês da compra). */
  fatura?: { ano: number; mes: number } | null;
};

type CategoriaVoz = { id: string; nome: string; tipo: "gasto" | "investimento"; oculta?: boolean };

const dataValida = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Resposta da função → linhas editáveis (categoria por nome, data falada ou o padrão do mês). */
export function itensParaLinhas(itens: ItemVoz[], categorias: CategoriaVoz[], periodo: Periodo, agora: Date = new Date()): LinhaVoz[] {
  return itens.map((i, k) => {
    const doTipo = categorias.filter((c) => !c.oculta && c.tipo === (i.tipo === "investimento" ? "investimento" : "gasto"));
    const categoriaId =
      i.tipo === "entrada" ? null : (doTipo.find((c) => normalizar(c.nome) === normalizar(i.categoria ?? ""))?.id ?? null);
    const centavos = paraCentavos(i.valor);
    return {
      id: `v${k}`,
      tipo: i.tipo,
      descricao: i.descricao.trim().slice(0, 120) || "Lançamento por voz",
      centavos: Math.abs(centavos),
      resgate: i.tipo === "investimento" && centavos < 0,
      categoriaId,
      categoriaSugerida: categoriaId,
      parcelas: Math.min(12, Math.max(1, Math.trunc(i.parcelas || 1))),
      forma: i.forma_pagamento,
      data: dataValida(i.data) ? i.data! : dataPadrao(periodo, agora),
      cartaoId: null,
    };
  });
}

/** Efeito no Disponível: entrada e resgate somam; gasto, conta fixa e aporte subtraem. */
export function totalPrevisto(linhas: LinhaVoz[]): number {
  return linhas.reduce((s, l) => s + (l.tipo === "entrada" || l.resgate ? l.centavos : -l.centavos), 0);
}

export type Insercao = {
  tabela: "entradas" | "contas_fixas" | "gastos_variaveis" | "investimentos";
  valores: Record<string, unknown>;
  /** > 1: depois de gravar, parcelar com a RPC parcelar_lancamento. */
  parcelas: number;
};

/**
 * Linha confirmada → registro da tabela do tipo, no mês selecionado, com origem "voz".
 * Gasto no crédito com cartão: liga ao cartão e vai para o mês da fatura (docs/08-cartao.md).
 */
export function montarInsercao(l: LinhaVoz, periodo: Periodo, cartao?: { id: string; nome: string; regra: RegraCartao | null }): Insercao {
  const base = { descricao: l.descricao, ano: periodo.ano, mes: periodo.mes, origem: "voz" };
  const valor = deCentavos(l.centavos);
  switch (l.tipo) {
    case "entrada":
      return { tabela: "entradas", valores: { ...base, valor, recebido: true, data: l.data }, parcelas: 1 };
    case "conta_fixa":
      return { tabela: "contas_fixas", valores: { ...base, valor, pago: false, vencimento: l.data, categoria_id: l.categoriaId }, parcelas: l.parcelas };
    case "investimento":
      return { tabela: "investimentos", valores: { ...base, valor: l.resgate ? -valor : valor, data: l.data, categoria_id: l.categoriaId }, parcelas: 1 };
    case "gasto": {
      const forma = l.forma === "nao_informado" ? "pix" : l.forma;
      const valores: Record<string, unknown> = { ...base, valor, pago: true, forma_pagamento: forma, data: l.data, categoria_id: l.categoriaId };
      if (forma === "credito") {
        if (cartao) {
          valores.conta_bancaria_id = cartao.id;
          valores.cartao = cartao.nome;
        }
        const f = l.fatura ?? sugerirFatura(l.data, cartao?.regra ?? null);
        valores.ano = f.ano;
        valores.mes = f.mes;
      }
      return { tabela: "gastos_variaveis", valores, parcelas: l.parcelas };
    }
  }
}
