import { supabase } from "../../lib/supabase";
import { formatarData, parseData } from "../../lib/datas";
import { paraCentavos } from "../../lib/dinheiro";
import type { ContaFixaAberta, LancamentoGravado, TransferenciaGravada } from "../../lib/importacao";

const somarDias = (data: string, dias: number) => {
  const d = parseData(data);
  return formatarData(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias));
};

/** Tudo o que a pré-visualização precisa saber do que já está gravado. */
export type ContextoImportacao = {
  chavesExistentes: Set<string>;
  gravados: LancamentoGravado[];
  transferencias: TransferenciaGravada[];
  contasFixas: ContaFixaAberta[];
};

export async function carregarContexto(contaId: string, chaves: string[], datas: string[]): Promise<ContextoImportacao> {
  const ordenadas = [...datas].sort();
  const de = somarDias(ordenadas[0]!, -2);
  const ate = somarDias(ordenadas[ordenadas.length - 1]!, 2);

  // Chaves já importadas nesta conta (em lotes, para não estourar o tamanho da URL)
  const chavesExistentes = new Set<string>();
  for (let i = 0; i < chaves.length; i += 100) {
    const { data, error } = await supabase
      .from("importacoes_chaves")
      .select("chave")
      .eq("conta_bancaria_id", contaId)
      .in("chave", chaves.slice(i, i + 100));
    if (error) throw error;
    for (const r of data) chavesExistentes.add(r.chave);
  }

  // Outra ponta possível de transferência: entradas/gastos importados de OUTRAS contas, no período ±2 dias
  const [ent, gas, tra] = await Promise.all([
    supabase.from("entradas").select("id, data, valor, descricao, conta_bancaria_id").eq("origem", "importado")
      .not("conta_bancaria_id", "is", null).neq("conta_bancaria_id", contaId).gte("data", de).lte("data", ate),
    supabase.from("gastos_variaveis").select("id, data, valor, descricao, conta_bancaria_id").eq("origem", "importado")
      .not("conta_bancaria_id", "is", null).neq("conta_bancaria_id", contaId).gte("data", de).lte("data", ate),
    supabase.from("transferencias").select("conta_origem_id, conta_destino_id, data, valor").gte("data", de).lte("data", ate),
  ]);
  for (const r of [ent, gas, tra]) if (r.error) throw r.error;

  type Linha = { id: string; data: string; valor: number | string; descricao: string; conta_bancaria_id: string };
  const gravados: LancamentoGravado[] = [
    ...(ent.data as Linha[]).map((e) => ({ id: e.id, tabela: "entradas" as const, contaId: e.conta_bancaria_id, data: e.data, centavos: paraCentavos(e.valor), descricao: e.descricao })),
    ...(gas.data as Linha[]).map((g) => ({ id: g.id, tabela: "gastos_variaveis" as const, contaId: g.conta_bancaria_id, data: g.data, centavos: -paraCentavos(g.valor), descricao: g.descricao })),
  ];
  const transferencias = (tra.data as { conta_origem_id: string; conta_destino_id: string; data: string; valor: number | string }[]).map((t) => ({
    contaOrigemId: t.conta_origem_id,
    contaDestinoId: t.conta_destino_id,
    data: t.data,
    centavos: paraCentavos(t.valor),
  }));

  // Contas fixas não pagas dos meses do extrato
  const meses = [...new Set(datas.map((d) => d.slice(0, 7)))].map((m) => ({ ano: Number(m.slice(0, 4)), mes: Number(m.slice(5, 7)) }));
  const cf = await supabase
    .from("contas_fixas")
    .select("id, descricao, valor, pago, ano, mes")
    .eq("pago", false)
    .or(meses.map((m) => `and(ano.eq.${m.ano},mes.eq.${m.mes})`).join(","));
  if (cf.error) throw cf.error;

  return { chavesExistentes, gravados, transferencias, contasFixas: cf.data as ContaFixaAberta[] };
}

export type ItemImportacao = Record<string, string | number | null>;
export type ResultadoImportacao = { inseridos: number; pulados: number; convertidas: string[] };

export async function gravarImportacao(itens: ItemImportacao[]): Promise<ResultadoImportacao> {
  const { data, error } = await supabase.rpc("importar_lancamentos", { p_itens: itens });
  if (error) throw error;
  return data as ResultadoImportacao;
}

export async function desfazerConversoes(ids: string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await supabase.rpc("desfazer_conversao", { p_transferencia_id: id });
    if (error) throw error;
  }
}
