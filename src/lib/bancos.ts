// CSV próprios de cada banco (docs/07-importacao.md, etapa B3). Um banco por vez.
// Reconhece o arquivo pelo cabeçalho e devolve as transações já com o sinal do app
// (crédito > 0, débito < 0). Arquivo não reconhecido cai no mapeamento genérico (planilha.ts).

import { normalizar } from "./categorizar";
import { dataDaCelula, valorDaCelula, type Celula, type TipoPlanilha } from "./planilha";

export type TransacaoBanco = {
  data: string;
  centavos: number;
  descricao: string;
  /** Id único que o banco dá à transação (vira a chave "ofx:<id>" para não duplicar). */
  fitid: string | null;
  tipo: TipoPlanilha | null;
  categoria: string | null;
};

export type ExtratoBanco = {
  banco: string;
  tipoConta: "banco" | "cartao";
  transacoes: TransacaoBanco[];
  /** Linhas (a partir de 1) com conteúdo mas sem data/valor válidos. */
  ignoradas: number[];
};

const texto = (c: Celula | undefined) => (c === null || c === undefined ? "" : c instanceof Date ? "" : String(c).trim());
const cabecalhoIgual = (linha: Celula[] | undefined, esperado: string[]) =>
  !!linha && linha.length >= esperado.length && esperado.every((e, i) => normalizar(texto(linha[i])) === e);

/** Pagamento da fatura ou de conta paga com saldo: candidato a transferência entre minhas contas. */
const PAGAMENTO_FATURA = /\b(pagamento recebido|pagamento da fatura|pagamento fatura)\b/;

/**
 * Nubank conta: "Data,Valor,Identificador,Descrição"; data dd/mm/aaaa; valor com sinal
 * (entrada > 0); Identificador é único por transação.
 */
function nubankConta(linhas: Celula[][]): ExtratoBanco | null {
  if (!cabecalhoIgual(linhas[0], ["data", "valor", "identificador", "descricao"])) return null;
  const r: ExtratoBanco = { banco: "Nubank", tipoConta: "banco", transacoes: [], ignoradas: [] };
  linhas.slice(1).forEach((l, i) => {
    if (l.every((c) => texto(c) === "")) return;
    const data = dataDaCelula(l[0] ?? null);
    const centavos = valorDaCelula(l[1] ?? null);
    if (!data || !centavos) return void r.ignoradas.push(i + 2);
    const id = texto(l[2]);
    r.transacoes.push({ data, centavos, descricao: texto(l[3]).slice(0, 200) || "Sem descrição", fitid: id ? `nubank:${id}` : null, tipo: null, categoria: null });
  });
  return r;
}

/**
 * Nubank cartão: "date,title,amount" (algumas versões trazem "category" no meio).
 * Data aaaa-mm-dd; compra POSITIVA e pagamento/estorno NEGATIVO → inverte o sinal.
 * "Pagamento recebido" vira sugestão de transferência (a fatura paga pela conta).
 */
function nubankCartao(linhas: Celula[][]): ExtratoBanco | null {
  const cab = (linhas[0] ?? []).map((c) => normalizar(texto(c)));
  const iData = cab.indexOf("date");
  const iTitulo = cab.indexOf("title");
  const iValor = cab.indexOf("amount");
  if (iData !== 0 || iTitulo < 0 || iValor < 0) return null;
  const iCat = cab.indexOf("category");
  const r: ExtratoBanco = { banco: "Nubank", tipoConta: "cartao", transacoes: [], ignoradas: [] };
  linhas.slice(1).forEach((l, i) => {
    if (l.every((c) => texto(c) === "")) return;
    const data = dataDaCelula(l[iData] ?? null);
    const valor = valorDaCelula(l[iValor] ?? null);
    if (!data || !valor) return void r.ignoradas.push(i + 2);
    const descricao = texto(l[iTitulo]).slice(0, 200) || "Sem descrição";
    r.transacoes.push({
      data,
      centavos: -valor,
      descricao,
      fitid: null, // o CSV do cartão não tem id: a chave vem do hash (data+valor+descrição, com #n)
      tipo: PAGAMENTO_FATURA.test(normalizar(descricao)) ? "transferencia" : null,
      categoria: iCat >= 0 ? texto(l[iCat]) || null : null,
    });
  });
  return r;
}

/** Linha do cabeçalho (até a 15ª) cuja 1ª célula normalizada é `primeira` e que tem a coluna `obrigatoria`. */
function acharCabecalho(linhas: Celula[][], primeira: string, obrigatoria: string): { i: number; cab: string[] } | null {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const cab = (linhas[i] ?? []).map((c) => normalizar(texto(c)));
    if (cab[0] === primeira && cab.includes(obrigatoria)) return { i, cab };
  }
  return null;
}

/**
 * Inter conta: título (Conta/Período/Saldo) e depois "Data Lançamento;[Histórico;]Descrição;Valor;Saldo".
 * Valor com sinal e vírgula decimal. A coluna Saldo é ignorada. Sem id → chave por hash.
 * (Formato conhecido dos exports do Inter; ainda não conferido com um arquivo real.)
 */
function interConta(linhas: Celula[][]): ExtratoBanco | null {
  const h = acharCabecalho(linhas, "data lancamento", "valor");
  if (!h) return null;
  const iHist = h.cab.indexOf("historico");
  const iDesc = h.cab.indexOf("descricao");
  const iValor = h.cab.indexOf("valor");
  const r: ExtratoBanco = { banco: "Inter", tipoConta: "banco", transacoes: [], ignoradas: [] };
  linhas.slice(h.i + 1).forEach((l, k) => {
    if (l.every((c) => texto(c) === "")) return;
    const data = dataDaCelula(l[0] ?? null);
    const centavos = valorDaCelula(l[iValor] ?? null);
    if (!data || !centavos) return void r.ignoradas.push(h.i + k + 2);
    const partes = [iHist >= 0 ? texto(l[iHist]) : "", iDesc >= 0 ? texto(l[iDesc]) : ""].filter(Boolean);
    const descricao = partes.join(" - ").replace(/\s+/g, " ").slice(0, 200) || "Sem descrição";
    r.transacoes.push({ data, centavos, descricao, fitid: null, tipo: null, categoria: null });
  });
  return r;
}

/**
 * Inter cartão: "Data;Lançamento;Categoria;Tipo;Valor" com valor "R$ 99,99": compra POSITIVA,
 * pagamento/estorno negativo → inverte o sinal. "Pagamento" sugere transferência.
 * (Formato conhecido dos exports do Inter; ainda não conferido com um arquivo real.)
 */
function interCartao(linhas: Celula[][]): ExtratoBanco | null {
  const h = acharCabecalho(linhas, "data", "lancamento");
  if (!h || !h.cab.includes("valor") || h.cab.includes("saldo")) return null;
  const iLanc = h.cab.indexOf("lancamento");
  const iCat = h.cab.indexOf("categoria");
  const iValor = h.cab.indexOf("valor");
  const r: ExtratoBanco = { banco: "Inter", tipoConta: "cartao", transacoes: [], ignoradas: [] };
  linhas.slice(h.i + 1).forEach((l, k) => {
    if (l.every((c) => texto(c) === "")) return;
    const data = dataDaCelula(l[0] ?? null);
    const valor = valorDaCelula(l[iValor] ?? null);
    if (!data || !valor) return void r.ignoradas.push(h.i + k + 2);
    const descricao = texto(l[iLanc]).replace(/\s+/g, " ").slice(0, 200) || "Sem descrição";
    r.transacoes.push({
      data,
      centavos: -valor,
      descricao,
      fitid: null,
      tipo: valor < 0 && /\bpagamento\b/.test(normalizar(descricao)) ? "transferencia" : null,
      categoria: iCat >= 0 ? texto(l[iCat]) || null : null,
    });
  });
  return r;
}

const LEITORES = [nubankConta, nubankCartao, interConta, interCartao];

/** Tenta cada banco conhecido; null = formato desconhecido (usa o mapeamento de colunas). */
export function lerCsvDeBanco(linhas: Celula[][]): ExtratoBanco | null {
  for (const ler of LEITORES) {
    const r = ler(linhas);
    if (r) return r;
  }
  return null;
}
