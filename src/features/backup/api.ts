// Backup: lê todas as tabelas da pessoa (RLS limita aos próprios dados) e restaura pela RPC transacional.
import { supabase } from "../../lib/supabase";
import { TABELAS_BACKUP, type Backup, type Linha, type TabelaBackup } from "../../lib/backup";

const PAGINA = 1000; // limite padrão de linhas por consulta no Supabase

async function todas(tabela: string, ordem: readonly string[]): Promise<Linha[]> {
  const linhas: Linha[] = [];
  for (let de = 0; ; de += PAGINA) {
    let q = supabase.from(tabela).select("*");
    for (const c of ordem) q = q.order(c);
    const { data, error } = await q.range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data as Linha[]));
    if (data.length < PAGINA) return linhas;
  }
}

/** Todas as linhas de todas as tabelas do backup. */
export async function lerTudo(): Promise<Record<TabelaBackup, Linha[]>> {
  const partes = await Promise.all(TABELAS_BACKUP.map(async ({ tabela, ordem }) => [tabela, await todas(tabela, ordem)] as const));
  return Object.fromEntries(partes) as Record<TabelaBackup, Linha[]>;
}

/** Quantas linhas existem hoje em cada tabela (para comparar com o arquivo antes de restaurar). */
export async function contarAtual(): Promise<Record<TabelaBackup, number>> {
  const partes = await Promise.all(
    TABELAS_BACKUP.map(async ({ tabela }) => {
      const { count, error } = await supabase.from(tabela).select("*", { count: "exact", head: true });
      if (error) throw error;
      return [tabela, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(partes) as Record<TabelaBackup, number>;
}

/** Troca todos os dados pelos do arquivo, numa transação só (tudo ou nada). Devolve quantas linhas entraram. */
export async function restaurar(backup: Backup): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("restaurar_backup", { p_dados: backup });
  if (error) throw error;
  return data as Record<string, number>;
}

/** Entrega o arquivo .json para o navegador salvar. */
export function baixarJson(conteudo: unknown, arquivo: string): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(conteudo, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
