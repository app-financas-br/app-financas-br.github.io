// Dinheiro: cálculos sempre em centavos inteiros.
// O banco devolve numeric como número ou string — sempre passar por Number().

export type Moeda = "BRL" | "USD" | "EUR";

/** Valor em reais (número ou string do banco) → centavos inteiros. */
export function paraCentavos(valor: number | string | null | undefined): number {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n)) return 0;
  // Desloca a vírgula pela notação decimal ("1.005e2" = 100.5) para fugir do erro binário (1.005 * 100 = 100.4999…)
  const texto = String(n);
  const deslocado = texto.includes("e") ? n * 100 : Number(`${texto}e2`);
  return Math.round(deslocado);
}

/** Centavos → valor em reais (para gravar no banco). */
export function deCentavos(centavos: number): number {
  return Math.round(centavos) / 100;
}

const formatadores = new Map<Moeda, Intl.NumberFormat>();

/** Formata centavos na moeda escolhida, no padrão brasileiro (R$ 1.234,56). */
export function formatarMoeda(centavos: number, moeda: Moeda = "BRL"): string {
  let f = formatadores.get(moeda);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda });
    formatadores.set(moeda, f);
  }
  return f.format(centavos / 100);
}

/** Formata uma variação percentual com sinal: +6,21% / -1,08%. */
export function formatarPercentual(valor: number, casas = 2): string {
  const sinal = valor > 0 ? "+" : valor < 0 ? "-" : "";
  return `${sinal}${Math.abs(valor).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/**
 * Lê o que a pessoa digitou ("1.234,56", "52,9", "R$ 10", "1234.5") → centavos.
 * Devolve null quando não dá para entender.
 */
export function parseValor(texto: string): number | null {
  let s = texto.replace(/[R$€\s ]/gi, "").replace(/^US/i, "");
  if (!s) return null;
  const negativo = s.startsWith("-");
  if (negativo) s = s.slice(1);

  if (s.includes(",")) {
    // Vírgula = decimal; pontos = milhar
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" ou "1.234.567" = milhar
    s = s.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const centavos = Math.round(Number(s) * 100);
  return negativo ? -centavos : centavos;
}
