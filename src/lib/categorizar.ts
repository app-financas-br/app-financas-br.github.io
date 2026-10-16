// Auto-categorização (docs/01-produto.md → Categorias).
// Prioridade: categoria gravada na linha → regra manual para o mesmo nome → palavras-chave → Outros.

export type CategoriaParaCasar = { id: string; nome: string; palavras: string[]; oculta?: boolean; ordem?: number };
export type RegraCategoria = { termo: string; categoria_id: string };

/** Minúsculas, sem acento, só letras/números separados por um espaço. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Procura a palavra (ou expressão) como palavra inteira dentro do texto já normalizado. */
function contemPalavra(textoNormalizado: string, palavra: string): boolean {
  const p = normalizar(palavra);
  return p.length > 0 && ` ${textoNormalizado} `.includes(` ${p} `);
}

/**
 * Devolve o id da categoria para uma descrição, ou null se não houver nem "Outros".
 * Entre várias palavras que casam, vence a mais longa (ex.: "pao de acucar" ganha de "acucar");
 * empate fica com a categoria de menor ordem.
 */
export function categorizar(
  descricao: string,
  { categorias, regras, categoriaIdAtual }: { categorias: CategoriaParaCasar[]; regras: RegraCategoria[]; categoriaIdAtual?: string | null },
): string | null {
  const visiveis = categorias.filter((c) => !c.oculta);
  const existe = (id: string) => visiveis.some((c) => c.id === id);

  if (categoriaIdAtual && existe(categoriaIdAtual)) return categoriaIdAtual;

  const termo = normalizar(descricao);
  const regra = regras.find((r) => r.termo === termo);
  if (regra && existe(regra.categoria_id)) return regra.categoria_id;

  let melhor: { id: string; tamanho: number; ordem: number } | null = null;
  if (termo) {
    for (const c of visiveis) {
      for (const palavra of c.palavras) {
        if (!contemPalavra(termo, palavra)) continue;
        const tamanho = normalizar(palavra).length;
        const ordem = c.ordem ?? 0;
        if (!melhor || tamanho > melhor.tamanho || (tamanho === melhor.tamanho && ordem < melhor.ordem)) {
          melhor = { id: c.id, tamanho, ordem };
        }
      }
    }
  }
  if (melhor) return melhor.id;

  return visiveis.find((c) => normalizar(c.nome) === "outros")?.id ?? null;
}
