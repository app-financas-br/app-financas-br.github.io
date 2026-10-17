// Backup JSON de todos os dados da pessoa (Configurações → "Baixar backup" / "Restaurar backup").
// A restauração acontece no banco, numa transação só: RPC restaurar_backup
// (supabase/migrations/20261017010000_restaurar_backup.sql), que usa a mesma lista de tabelas.

export const FORMATO_BACKUP = "financas-backup";
export const VERSAO_BACKUP = 1;

/** Tabelas do backup e a ordem estável para ler em páginas (voz_uso fica de fora: é só o limite diário). */
export const TABELAS_BACKUP = [
  { tabela: "preferencias", ordem: ["user_id"] },
  { tabela: "planejamento_grupos", ordem: ["id"] },
  { tabela: "categorias", ordem: ["id"] },
  { tabela: "categoria_regras", ordem: ["id"] },
  { tabela: "contas_bancarias", ordem: ["id"] },
  { tabela: "planejamentos", ordem: ["id"] },
  { tabela: "planejamento_percentuais", ordem: ["planejamento_id", "grupo_id"] },
  { tabela: "entradas", ordem: ["id"] },
  { tabela: "contas_fixas", ordem: ["id"] },
  { tabela: "gastos_variaveis", ordem: ["id"] },
  { tabela: "investimentos", ordem: ["id"] },
  { tabela: "transferencias", ordem: ["id"] },
  { tabela: "importacoes_chaves", ordem: ["conta_bancaria_id", "chave"] },
  { tabela: "metas", ordem: ["id"] },
  { tabela: "tarefas", ordem: ["id"] },
] as const;

export type TabelaBackup = (typeof TABELAS_BACKUP)[number]["tabela"];
export type Linha = Record<string, unknown>;
export type Backup = {
  formato: typeof FORMATO_BACKUP;
  versao: typeof VERSAO_BACKUP;
  gerado_em: string;
  tabelas: Record<TabelaBackup, Linha[]>;
};

export function montarBackup(tabelas: Record<TabelaBackup, Linha[]>, agora: Date = new Date()): Backup {
  return { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, gerado_em: agora.toISOString(), tabelas };
}

/** Quantas linhas por tabela (para mostrar antes de restaurar). */
export function contarLinhas(tabelas: Partial<Record<TabelaBackup, Linha[]>>): Record<TabelaBackup, number> {
  return Object.fromEntries(TABELAS_BACKUP.map(({ tabela }) => [tabela, tabelas[tabela]?.length ?? 0])) as Record<TabelaBackup, number>;
}

export type LeituraBackup = { ok: true; backup: Backup } | { ok: false; erro: "json" | "formato" | "versao" };

/** Lê o texto do arquivo e confere se é um backup deste app (antes de pedir confirmação). */
export function lerBackup(texto: string): LeituraBackup {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    return { ok: false, erro: "json" };
  }
  const d = dados as Partial<Backup> | null;
  if (!d || typeof d !== "object" || d.formato !== FORMATO_BACKUP || typeof d.tabelas !== "object" || d.tabelas === null) {
    return { ok: false, erro: "formato" };
  }
  if (d.versao !== VERSAO_BACKUP) return { ok: false, erro: "versao" };
  for (const { tabela } of TABELAS_BACKUP) {
    const linhas = (d.tabelas as Record<string, unknown>)[tabela];
    if (linhas !== undefined && !Array.isArray(linhas)) return { ok: false, erro: "formato" };
  }
  const tabelas = Object.fromEntries(
    TABELAS_BACKUP.map(({ tabela }) => [tabela, ((d.tabelas as Record<string, Linha[] | undefined>)[tabela] ?? []) as Linha[]]),
  ) as Record<TabelaBackup, Linha[]>;
  return { ok: true, backup: { formato: FORMATO_BACKUP, versao: VERSAO_BACKUP, gerado_em: String(d.gerado_em ?? ""), tabelas } };
}

/** "financas-backup-2026-10-16.json" */
export function nomeArquivoBackup(dataLocal: string): string {
  return `financas-backup-${dataLocal}.json`;
}
