import { describe, expect, it } from "vitest";
import { contarLinhas, lerBackup, montarBackup, nomeArquivoBackup, TABELAS_BACKUP, type Linha, type TabelaBackup } from "./backup";

const vazio = () => Object.fromEntries(TABELAS_BACKUP.map(({ tabela }) => [tabela, [] as Linha[]])) as Record<TabelaBackup, Linha[]>;

describe("backup JSON", () => {
  it("tem todas as tabelas de dados da pessoa, sem o contador da voz", () => {
    const nomes = TABELAS_BACKUP.map((x) => x.tabela);
    for (const t of ["gastos_variaveis", "entradas", "contas_fixas", "categorias", "planejamentos", "planejamento_grupos", "planejamento_percentuais", "investimentos", "metas", "contas_bancarias", "transferencias"]) {
      expect(nomes).toContain(t);
    }
    expect(nomes).not.toContain("voz_uso");
  });

  it("ida e volta: o arquivo gerado é lido de novo com as mesmas linhas", () => {
    const tabelas = { ...vazio(), gastos_variaveis: [{ id: "g1", descricao: "TESTE-Mercado", valor: 52.9, ano: 2026, mes: 10 }], metas: [{ id: "m1", nome: "Viagem" }] };
    const texto = JSON.stringify(montarBackup(tabelas, new Date(Date.UTC(2026, 9, 16, 12))));
    const lido = lerBackup(texto);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    expect(lido.backup.gerado_em).toBe("2026-10-16T12:00:00.000Z");
    expect(lido.backup.tabelas.gastos_variaveis).toEqual(tabelas.gastos_variaveis);
    expect(contarLinhas(lido.backup.tabelas)).toMatchObject({ gastos_variaveis: 1, metas: 1, entradas: 0 });
  });

  it("recusa arquivo que não é JSON, de outro formato, de outra versão ou com tabela que não é lista", () => {
    expect(lerBackup("não é json")).toEqual({ ok: false, erro: "json" });
    expect(lerBackup(JSON.stringify({ planilha: [] }))).toEqual({ ok: false, erro: "formato" });
    expect(lerBackup(JSON.stringify({ ...montarBackup(vazio()), versao: 2 }))).toEqual({ ok: false, erro: "versao" });
    expect(lerBackup(JSON.stringify({ ...montarBackup(vazio()), tabelas: { gastos_variaveis: "x" } }))).toEqual({ ok: false, erro: "formato" });
  });

  it("tabela ausente no arquivo vira lista vazia", () => {
    const lido = lerBackup(JSON.stringify({ formato: "financas-backup", versao: 1, gerado_em: "", tabelas: { metas: [{ id: "m" }] } }));
    expect(lido.ok && lido.backup.tabelas.gastos_variaveis).toEqual([]);
  });

  it("nome do arquivo com a data local", () => {
    expect(nomeArquivoBackup("2026-10-16")).toBe("financas-backup-2026-10-16.json");
  });
});
