// Regras puras de categorias (sem banco, para testar).
import { normalizar } from "../../lib/categorizar";

/**
 * Chave para comparar nomes: minúsculas, sem acento, só letras/números ("Saúde" = "saude" = " SAUDE! ").
 * O banco usa a mesma regra em public.nome_normalizado (índice único por usuário e tipo).
 */
export const chaveNome = (nome: string) => normalizar(nome);

/** Já existe outra categoria (do mesmo tipo) com o mesmo nome, ignorando maiúsculas, acentos e pontuação? */
export function nomeRepetido(nome: string, outras: { id: string; nome: string }[], ignorarId?: string): boolean {
  const chave = chaveNome(nome);
  return outras.some((c) => c.id !== ignorarId && chaveNome(c.nome) === chave);
}

/** Nome livre para uma categoria nova ("Nova categoria", "Nova categoria 2"…). */
export function nomeLivre(base: string, existentes: string[]): string {
  const usados = new Set(existentes.map(chaveNome));
  if (!usados.has(chaveNome(base))) return base;
  for (let i = 2; ; i++) if (!usados.has(chaveNome(`${base} ${i}`))) return `${base} ${i}`;
}

// Paleta para categorias novas: as cores de série de tokens.css (--chart-1..6) e mais tons bem distintos.
// Ficam gravadas no banco como dado (hex), por isso não usam var().
export const PALETA_CATEGORIAS = [
  "#2affbd", "#ffa31c", "#2f8fe8", "#a26ad5", "#22d3ee", "#f2d85d",
  "#f97316", "#e5484d", "#ec4899", "#84cc16", "#14b8a6", "#8b5cf6",
];

function hslParaHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Primeira cor da paleta que nenhuma outra categoria usa; esgotada a paleta, gera tons novos (ângulo áureo). */
export function corLivre(usadas: string[]): string {
  const ocupadas = new Set(usadas.map((c) => c.trim().toLowerCase()));
  const daPaleta = PALETA_CATEGORIAS.find((c) => !ocupadas.has(c));
  if (daPaleta) return daPaleta;
  for (let i = 0; i < 360; i++) {
    const cor = hslParaHex((i * 137.508) % 360, 0.7, 0.6);
    if (!ocupadas.has(cor)) return cor;
  }
  return PALETA_CATEGORIAS[0]!;
}
