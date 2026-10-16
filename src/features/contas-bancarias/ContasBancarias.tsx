import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { CelulaTexto, CelulaValor } from "../lancamentos/celulas";
import { CorCategoria } from "../categorias/Categorias";
import { corLivre, nomeLivre, nomeRepetido } from "../categorias/regrasCategoria";
import { usePreferencias } from "../preferencias/usePreferencias";
import { TIPOS_CONTA, useAtualizarConta, useContasBancarias, useCriarConta, useExcluirContaComDesfazer, type ContaBancaria, type TipoConta } from "./api";
import { t } from "../../i18n/pt-BR";

const botaoIcone = "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-faint hover:bg-card-hover";
const seletor =
  "h-9 w-full min-w-0 cursor-pointer rounded-md border border-border bg-input px-2 text-text outline-none focus:border-border-glow [&>option]:bg-elevated";
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Configurações → Contas bancárias: criar, renomear, banco, tipo, saldo inicial, cor, desativar e excluir. */
export function ContasBancarias() {
  const { data, isPending, isError, refetch } = useContasBancarias();
  const { prefs } = usePreferencias();
  const { mostrar } = useToast();
  const criar = useCriarConta();
  const atualizar = useAtualizarConta();
  const excluir = useExcluirContaComDesfazer();
  const [novaId, setNovaId] = useState<string | null>(null);

  if (isPending) return <Skeleton className="h-40" />;
  if (isError) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Aviso tipo="erro">{t.contas.erro}</Aviso>
        <Button variante="contorno" onClick={() => refetch()}>{t.dashboard.tentarDeNovo}</Button>
      </Card>
    );
  }

  const erro = (e: unknown) => {
    console.error("[contas]", e);
    mostrar({ tipo: "erro", texto: (e as { code?: string }).code === "23505" ? t.contas.nomeRepetido : t.lanc.erroSalvar });
  };
  const salvar = (id: string, campos: Parameters<typeof atualizar.mutate>[0]["campos"]) => atualizar.mutate({ id, campos }, { onError: erro });
  const renomear = (c: ContaBancaria, nome: string) => {
    if (nomeRepetido(nome, data, c.id)) return mostrar({ tipo: "erro", texto: t.contas.nomeRepetido });
    salvar(c.id, { nome });
  };
  const adicionar = () =>
    criar.mutate(
      { nome: nomeLivre(t.contas.novaNome, data.map((c) => c.nome)), banco: "", tipo: "corrente", cor: corLivre(data.map((c) => c.cor)) },
      { onSuccess: (c) => setNovaId(c.id), onError: erro },
    );

  const ativas = data.filter((c) => c.ativa);
  const inativas = data.filter((c) => !c.ativa);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variante="contorno" className="h-9" onClick={adicionar} disabled={criar.isPending}>
          <Plus size={16} aria-hidden /> {t.contas.nova}
        </Button>
      </div>

      {ativas.length === 0 && inativas.length === 0 ? (
        <p className="py-4 text-center text-muted">{t.contas.vazio}</p>
      ) : (
        <ul className="flex flex-col">
          {ativas.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 border-b border-border py-2 last:border-b-0 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1fr)_10rem_9rem_auto]"
            >
              <CorCategoria cor={c.cor} nome={c.nome} onSalvar={(cor) => salvar(c.id, { cor })} />
              <CelulaTexto rotulo={t.contas.nome} valor={c.nome} maxLength={40} abrirAoMontar={c.id === novaId} onSalvar={(nome) => renomear(c, nome)} />
              {/* No celular, banco/tipo/saldo vão para a 2ª linha */}
              <div className="col-span-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] gap-1 md:contents">
                <div className="min-w-0 text-muted">
                  <CelulaTexto rotulo={t.contas.bancoDe(c.nome)} valor={c.banco || t.contas.banco} maxLength={40} onSalvar={(banco) => salvar(c.id, { banco })} />
                </div>
                <select
                  aria-label={t.contas.tipo(c.nome)}
                  value={c.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value as TipoConta;
                    // Fechamento/vencimento/conta que paga só existem em cartão (o banco recusa nos outros tipos)
                    salvar(c.id, tipo === "cartao_credito" ? { tipo } : { tipo, dia_fechamento: null, dia_vencimento: null, conta_pagamento_id: null });
                  }}
                  className="h-9 w-full min-w-0 cursor-pointer truncate rounded-md bg-transparent px-2 text-[length:var(--fs-sm)] text-muted outline-none hover:bg-card-hover [&>option]:bg-elevated"
                >
                  {TIPOS_CONTA.map((tp) => (
                    <option key={tp} value={tp}>{t.contas.tipos[tp]}</option>
                  ))}
                </select>
                <CelulaValor valor={c.saldo_inicial} moeda={prefs.moeda} rotulo={t.contas.saldoInicialDe(c.nome)} onSalvar={(saldo_inicial) => salvar(c.id, { saldo_inicial })} />
              </div>
              <div className="col-start-3 row-start-1 flex md:col-start-auto md:row-start-auto">
                <button type="button" className={`${botaoIcone} hover:text-text`} onClick={() => salvar(c.id, { ativa: false })} aria-label={t.contas.desativar(c.nome)} title={t.contas.desativar(c.nome)}>
                  <EyeOff size={16} />
                </button>
                <button type="button" className={`${botaoIcone} hover:text-danger`} onClick={() => excluir(c)} aria-label={t.contas.excluir(c.nome)} title={t.contas.excluir(c.nome)}>
                  <Trash2 size={16} />
                </button>
              </div>
              {c.tipo === "cartao_credito" && (
                <div className="col-span-3 flex flex-col gap-2 rounded-md bg-card-hover/40 p-2 text-[length:var(--fs-sm)] text-muted md:col-span-6 md:ml-10">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[7rem_7rem_minmax(0,1fr)]">
                    <label className="flex flex-col gap-1">
                      {t.contas.fechamento}
                      <select aria-label={t.contas.fechamentoDe(c.nome)} className={seletor} value={c.dia_fechamento ?? ""}
                        onChange={(e) => salvar(c.id, { dia_fechamento: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">—</option>
                        {DIAS.map((d) => <option key={d} value={d}>{t.contas.dia(d)}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      {t.contas.vencimento}
                      <select aria-label={t.contas.vencimentoDe(c.nome)} className={seletor} value={c.dia_vencimento ?? ""}
                        onChange={(e) => salvar(c.id, { dia_vencimento: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">—</option>
                        {DIAS.map((d) => <option key={d} value={d}>{t.contas.dia(d)}</option>)}
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                      {t.contas.pagaCom}
                      <select aria-label={t.contas.pagaComDe(c.nome)} className={seletor} value={c.conta_pagamento_id ?? ""}
                        onChange={(e) => salvar(c.id, { conta_pagamento_id: e.target.value || null })}>
                        <option value="">—</option>
                        {ativas.filter((o) => o.id !== c.id && o.tipo !== "cartao_credito").map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={c.compra_no_fechamento_proxima}
                      onChange={(e) => salvar(c.id, { compra_no_fechamento_proxima: e.target.checked })} />
                    {t.contas.noFechamentoProxima}
                  </label>
                  {(!c.dia_fechamento || !c.dia_vencimento) && <span className="text-warning">{t.contas.semRegra}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {inativas.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{t.contas.inativas}</p>
          {inativas.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1 text-muted">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full opacity-50" style={{ background: c.cor }} />
              <span className="flex-1 truncate">{c.nome}</span>
              <Button variante="fantasma" className="h-8 px-2" onClick={() => salvar(c.id, { ativa: true })} aria-label={t.contas.ativar(c.nome)}>
                <Eye size={16} aria-hidden /> {t.categorias.restaurar}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
