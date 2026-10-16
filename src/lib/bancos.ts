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

const LEITORES = [nubankConta, nubankCartao];

/** Tenta cada banco conhecido; null = formato desconhecido (usa o mapeamento de colunas). */
export function lerCsvDeBanco(linhas: Celula[][]): ExtratoBanco | null {
  for (const ler of LEITORES) {
    const r = ler(linhas);
    if (r) return r;
  }
  return null;
}
