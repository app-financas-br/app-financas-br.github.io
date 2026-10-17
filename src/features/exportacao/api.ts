// Busca os lançamentos do mês ou do ano para exportar (sempre filtra ano, e mês quando houver).
import { supabase } from "../../lib/supabase";
import type { DadosExportacao } from "../../lib/exportacao";

const PAGINA = 1000; // limite padrão de linhas por consulta no Supabase

async function todas<T>(tabela: string, ano: number, mes?: number): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    let q = supabase.from(tabela).select("*").eq("ano", ano);
    if (mes) q = q.eq("mes", mes);
    const { data, error } = await q.order("mes").order("id").range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data as T[]));
    if (data.length < PAGINA) return linhas;
  }
}

export async function buscarDadosExportacao(ano: number, mes?: number): Promise<DadosExportacao> {
  const [entradas, contasFixas, gastos, investimentos, categorias, contas] = await Promise.all([
    todas<DadosExportacao["entradas"][number]>("entradas", ano, mes),
    todas<DadosExportacao["contasFixas"][number]>("contas_fixas", ano, mes),
    todas<DadosExportacao["gastos"][number]>("gastos_variaveis", ano, mes),
    todas<DadosExportacao["investimentos"][number]>("investimentos", ano, mes),
    supabase.from("categorias").select("id, nome"),
    supabase.from("contas_bancarias").select("id, nome"),
  ]);
  if (categorias.error) throw categorias.error;
  if (contas.error) throw contas.error;
  return { entradas, contasFixas, gastos, investimentos, categorias: categorias.data, contasBancarias: contas.data };
}

/** Entrega o arquivo para o navegador salvar. */
export function baixar(conteudo: ArrayBuffer, arquivo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
