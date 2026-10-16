// Leitura de OFX 1.x (SGML) e 2.x (XML) no navegador. Nada é enviado: só bytes → objetos.

export type TransacaoOfx = {
  /** FITID do banco (null se o arquivo não trouxer). */
  fitid: string | null;
  /** AAAA-MM-DD, sem conversão de fuso. */
  data: string;
  /** Centavos com sinal: crédito > 0, débito < 0. */
  centavos: number;
  descricao: string;
};

export type ExtratoOfx = {
  tipoConta: "banco" | "cartao";
  banco: string | null;
  conta: string | null;
  transacoes: TransacaoOfx[];
};

/**
 * Bytes → texto. Texto com acento em latin-1/windows-1252 quase nunca é UTF-8 válido,
 * então: tenta UTF-8 estrito e, se falhar, usa windows-1252. Não confia no cabeçalho,
 * porque há bancos que declaram CHARSET:1252 e mandam UTF-8 (e vice-versa).
 */
export function decodificarOfx(bytes: Uint8Array): string {
  let texto: string;
  try {
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    texto = new TextDecoder("windows-1252").decode(bytes);
  }
  return texto.replace(/^﻿/, "");
}

function desescapar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Valor da tag no trecho: funciona com e sem tag de fechamento (SGML). */
function tag(trecho: string, nome: string): string | null {
  const m = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i").exec(trecho);
  if (!m) return null;
  const v = desescapar(m[1]!).replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

/** "20261016120000[-3:BRT]" → "2026-10-16" (só a data, para não deslocar o dia pelo fuso). */
export function dataOfx(valor: string | null): string | null {
  const m = valor ? /^(\d{4})(\d{2})(\d{2})/.exec(valor) : null;
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > new Date(ano, mes, 0).getDate()) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** "-52.90", "-52,90", "1.234,56", "+10" → centavos com sinal (sem passar por float). */
export function valorOfx(valor: string | null): number | null {
  if (!valor) return null;
  let s = valor.replace(/\s/g, "");
  const negativo = s.startsWith("-");
  s = s.replace(/^[+-]/, "");
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  const sep = Math.max(ultimaVirgula, ultimoPonto);
  // Separador decimal = o último, se tiver 1 ou 2 casas depois; o resto é milhar
  let inteiro = s;
  let frac = "";
  if (sep >= 0 && s.length - sep - 1 <= 2) {
    inteiro = s.slice(0, sep);
    frac = s.slice(sep + 1);
  }
  inteiro = inteiro.replace(/[.,]/g, "");
  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(frac) || inteiro + frac === "") return null;
  const centavos = Number(inteiro || "0") * 100 + Number(frac.padEnd(2, "0") || "0");
  return negativo ? -centavos : centavos;
}

/** Lê o extrato. Transações sem data ou valor válidos são descartadas. */
export function lerOfx(texto: string): ExtratoOfx {
  const corpo = texto.slice(Math.max(0, texto.search(/<OFX>/i)));
  const cartao = /<CCSTMTRS>/i.test(corpo);
  const contaTrecho = /<(BANKACCTFROM|CCACCTFROM)>([\s\S]*?)(<\/\1>|<BANKTRANLIST>)/i.exec(corpo)?.[2] ?? corpo;

  const blocos = corpo.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0]!);
  const transacoes: TransacaoOfx[] = [];
  for (const b of blocos) {
    const data = dataOfx(tag(b, "DTPOSTED"));
    const centavos = valorOfx(tag(b, "TRNAMT"));
    if (!data || centavos === null) continue;
    const memo = tag(b, "MEMO");
    const nome = tag(b, "NAME");
    const descricao =
      memo && nome && !memo.toLowerCase().includes(nome.toLowerCase()) ? `${nome} - ${memo}` : memo ?? nome ?? "Sem descrição";
    transacoes.push({ fitid: tag(b, "FITID"), data, centavos, descricao: descricao.slice(0, 200) });
  }

  return {
    tipoConta: cartao ? "cartao" : "banco",
    banco: tag(contaTrecho, "BANKID"),
    conta: tag(contaTrecho, "ACCTID"),
    transacoes,
  };
}
