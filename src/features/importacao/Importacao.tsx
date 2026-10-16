import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRightLeft, FileUp, Loader2, Receipt } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { decodificarOfx, lerOfx, type ExtratoOfx } from "../../lib/ofx";
import { categorizar } from "../../lib/categorizar";
import { formatarMoeda, paraCentavos } from "../../lib/dinheiro";
import { parseData } from "../../lib/datas";
import { chavesDasLinhas, contaFixaParecida, detectarTransferencias, nomeDoBanco, sugerirTipo } from "../../lib/importacao";
import { useCategorias, useRegrasCategoria } from "../categorias/useCategorias";
import { usePreferencias } from "../preferencias/usePreferencias";
import { corLivre, nomeLivre } from "../categorias/regrasCategoria";
import { useAtualizarConta, useContasBancarias, useCriarConta, type ContaBancaria } from "../contas-bancarias/api";
import { carregarContexto, desfazerConversoes, gravarImportacao } from "./api";
import { acaoDaLinha, linhasIncompletas, montarItens, type LinhaRevisao, type TipoLinha } from "./linhas";
import { t } from "../../i18n/pt-BR";

const TIPOS: TipoLinha[] = ["gasto", "entrada", "conta_fixa", "investimento", "transferencia"];
const NOVA = "__nova__";
const select =
  "h-9 w-full min-w-0 cursor-pointer truncate rounded-md border border-border bg-input px-2 text-[length:var(--fs-sm)] text-text outline-none focus:border-border-glow [&>option]:bg-elevated";
const campo = "h-9 w-full min-w-0 rounded-md border border-border bg-input px-2 text-text outline-none focus:border-border-glow";
const diaMes = (d: string) => parseData(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

type Etapa =
  | { nome: "arquivo"; erro?: string }
  | { nome: "conta"; extrato: ExtratoOfx }
  | { nome: "revisao"; extrato: ExtratoOfx; conta: ContaBancaria }
  | { nome: "gravando"; extrato: ExtratoOfx; conta: ContaBancaria };

export function Importacao() {
  const [etapa, setEtapa] = useState<Etapa>({ nome: "arquivo" });
  const [linhas, setLinhas] = useState<LinhaRevisao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [contaEscolhida, setContaEscolhida] = useState<string>(NOVA);
  const entradaArquivo = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { mostrar } = useToast();
  const { prefs } = usePreferencias();
  const fmt = (c: number) => formatarMoeda(c, prefs.moeda);
  const { data: contas = [] } = useContasBancarias();
  const { data: categorias = [] } = useCategorias();
  const { data: regras = [] } = useRegrasCategoria();
  const criarConta = useCriarConta();
  const atualizarConta = useAtualizarConta();

  const catGasto = useMemo(() => categorias.filter((c) => c.tipo === "gasto"), [categorias]);
  const catInvest = useMemo(() => categorias.filter((c) => c.tipo === "investimento"), [categorias]);
  const nomeConta = (id: string | null) => contas.find((c) => c.id === id)?.nome ?? "?";

  const categoriaPara = (tipo: TipoLinha, descricao: string) =>
    tipo === "investimento"
      ? categorizar(descricao, { categorias: catInvest, regras: [] }) ?? catInvest.find((c) => !c.oculta)?.id ?? null
      : tipo === "gasto" || tipo === "conta_fixa" || tipo === "transferencia"
        ? categorizar(descricao, { categorias: catGasto, regras })
        : null;

  // 1) Arquivo → extrato
  const lerArquivo = async (arquivo: File) => {
    setCarregando(true);
    try {
      const extrato = lerOfx(decodificarOfx(new Uint8Array(await arquivo.arrayBuffer())));
      if (extrato.transacoes.length === 0) return setEtapa({ nome: "arquivo", erro: t.importacao.arquivoInvalido });
      const conhecida = contas.find((c) => c.ofx_conta && c.ofx_conta === extrato.conta && (c.ofx_banco ?? "") === (extrato.banco ?? ""));
      if (conhecida) return await prepararRevisao(extrato, conhecida);
      setContaEscolhida(NOVA);
      setEtapa({ nome: "conta", extrato });
    } catch (e) {
      console.error("[importacao] ler", e);
      setEtapa({ nome: "arquivo", erro: t.importacao.arquivoInvalido });
    } finally {
      setCarregando(false);
      if (entradaArquivo.current) entradaArquivo.current.value = "";
    }
  };

  // 2) Conta escolhida (ou criada) → contexto do banco → linhas da pré-visualização
  const prepararRevisao = async (extrato: ExtratoOfx, conta: ContaBancaria) => {
    setCarregando(true);
    try {
      if (extrato.conta && !conta.ofx_conta) {
        atualizarConta.mutate({ id: conta.id, campos: { ofx_banco: extrato.banco, ofx_conta: extrato.conta } });
      }
      const tr = extrato.transacoes;
      const chaves = await chavesDasLinhas(conta.id, tr);
      const ctx = await carregarContexto(conta.id, chaves, tr.map((x) => x.data));
      const sugestoes = detectarTransferencias(
        tr.map((x, i) => ({ id: String(i), contaId: conta.id, data: x.data, centavos: x.centavos })),
        ctx.gravados,
        ctx.transferencias,
      );
      setLinhas(
        tr.map((x, i) => {
          const sugestao = sugestoes.get(String(i)) ?? null;
          const repetida = ctx.chavesExistentes.has(chaves[i]!);
          const tipo = sugerirTipo(x);
          return {
            id: String(i),
            chave: chaves[i]!,
            data: x.data,
            centavos: x.centavos,
            descricao: x.descricao,
            repetida,
            incluir: !repetida && sugestao?.tipo !== "ja_registrada",
            tipo,
            categoriaId: categoriaPara(tipo, x.descricao),
            outraContaId: sugestao && sugestao.tipo !== "ja_registrada" ? sugestao.outraContaId : null,
            sugestao,
            transfConfirmada: false,
            contaFixa: contaFixaParecida(x, ctx.contasFixas, paraCentavos),
            marcarPaga: false,
          };
        }),
      );
      setEtapa({ nome: "revisao", extrato, conta });
    } catch (e) {
      console.error("[importacao] preparar", e);
      setEtapa({ nome: "arquivo", erro: t.lanc.erroSalvar });
    } finally {
      setCarregando(false);
    }
  };

  const continuarConta = (extrato: ExtratoOfx) => {
    if (contaEscolhida !== NOVA) {
      const c = contas.find((x) => x.id === contaEscolhida);
      if (c) void prepararRevisao(extrato, c);
      return;
    }
    const banco = nomeDoBanco(extrato.banco) ?? "";
    criarConta.mutate(
      {
        nome: nomeLivre(banco || t.contas.novaNome, contas.map((c) => c.nome)),
        banco,
        tipo: extrato.tipoConta === "cartao" ? "cartao_credito" : "corrente",
        cor: corLivre(contas.map((c) => c.cor)),
        ofx_banco: extrato.banco,
        ofx_conta: extrato.conta,
      },
      {
        onSuccess: (c) => void prepararRevisao(extrato, c),
        onError: (e) => {
          console.error("[importacao] criar conta", e);
          mostrar({ tipo: "erro", texto: t.lanc.erroSalvar });
        },
      },
    );
  };

  const alterar = (id: string, campos: Partial<LinhaRevisao>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...campos } : l)));

  // 3) Confirmar → RPC única
  const confirmar = async (extrato: ExtratoOfx, conta: ContaBancaria) => {
    const itens = montarItens(linhas, conta.id, conta.tipo === "cartao_credito" ? "credito" : "debito");
    setEtapa({ nome: "gravando", extrato, conta });
    try {
      const r = await gravarImportacao(itens);
      await qc.invalidateQueries();
      mostrar({ tipo: "info", texto: t.importacao.pronto(r.inseridos, r.pulados) });
      if (r.convertidas.length > 0) {
        mostrar(
          {
            tipo: "info",
            texto: t.importacao.convertidas(r.convertidas.length),
            acao: {
              rotulo: t.lanc.desfazer,
              onClick: () =>
                desfazerConversoes(r.convertidas)
                  .then(() => qc.invalidateQueries())
                  .then(() => mostrar({ tipo: "info", texto: t.importacao.desfeito }))
                  .catch((e) => {
                    console.error("[importacao] desfazer", e);
                    mostrar({ tipo: "erro", texto: t.importacao.erroDesfazer });
                  }),
            },
          },
          5000,
        );
      }
      setLinhas([]);
      setEtapa({ nome: "arquivo" });
    } catch (e) {
      console.error("[importacao] gravar", e);
      mostrar({ tipo: "erro", texto: t.importacao.erroGravar });
      setEtapa({ nome: "revisao", extrato, conta });
    }
  };

  const voltar = (
    <Link to="/lancamentos" className="flex items-center gap-1 self-start text-[length:var(--fs-sm)] text-primary-text hover:underline">
      <ArrowLeft size={16} aria-hidden /> {t.importacao.voltar}
    </Link>
  );

  // ---------------------------------------------------------------- telas
  if (etapa.nome === "arquivo") {
    return (
      <div className="flex flex-col gap-[var(--gap-grid)]">
        {voltar}
        <Card className="flex flex-col items-start gap-3">
          <CardTitle>{t.importacao.titulo}</CardTitle>
          <p className="text-muted">{t.importacao.ajudaArquivo}</p>
          {etapa.erro && <Aviso tipo="erro">{etapa.erro}</Aviso>}
          <input ref={entradaArquivo} type="file" accept=".ofx,.qfx" className="sr-only" id="arquivo-ofx"
            onChange={(e) => e.target.files?.[0] && void lerArquivo(e.target.files[0])} />
          <Button onClick={() => entradaArquivo.current?.click()} disabled={carregando}>
            {carregando ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <FileUp size={18} aria-hidden />}
            {carregando ? t.importacao.lendo : t.importacao.escolher}
          </Button>
        </Card>
      </div>
    );
  }

  if (etapa.nome === "conta") {
    const { extrato } = etapa;
    const banco = nomeDoBanco(extrato.banco);
    return (
      <div className="flex flex-col gap-[var(--gap-grid)]">
        {voltar}
        <Card className="flex flex-col gap-3">
          <CardTitle>{t.importacao.conta}</CardTitle>
          {extrato.conta && <p className="text-muted">{t.importacao.contaDetectada(banco ?? extrato.banco ?? "?", extrato.conta)}</p>}
          <select aria-label={t.importacao.escolhaConta} className={`${select} h-11 max-w-sm`} value={contaEscolhida} onChange={(e) => setContaEscolhida(e.target.value)}>
            <option value={NOVA}>{t.importacao.criarConta(banco ?? t.contas.novaNome)}</option>
            {contas.filter((c) => c.ativa).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => continuarConta(extrato)} disabled={carregando || criarConta.isPending}>
              {(carregando || criarConta.isPending) && <Loader2 size={18} className="animate-spin" aria-hidden />}
              {t.importacao.importar}
            </Button>
            <Button variante="fantasma" onClick={() => setEtapa({ nome: "arquivo" })}>{t.importacao.outroArquivo}</Button>
          </div>
        </Card>
      </div>
    );
  }

  const { extrato, conta } = etapa;
  const gravando = etapa.nome === "gravando";
  const novas = linhas.filter((l) => acaoDaLinha(l) === "importar").length;
  const repetidas = linhas.filter((l) => l.repetida).length;
  const transf = linhas.filter((l) => l.sugestao && l.sugestao.tipo !== "ja_registrada" && !l.repetida).length;
  const incompletas = linhasIncompletas(linhas).length;

  return (
    <div className="flex flex-col gap-[var(--gap-grid)]">
      {voltar}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: conta.cor }} />
          <CardTitle className="mr-auto">{conta.nome}</CardTitle>
          <Button variante="fantasma" className="h-9" onClick={() => setEtapa({ nome: "arquivo" })} disabled={gravando}>
            {t.importacao.outroArquivo}
          </Button>
        </div>
        <p role="status" className="text-muted">{t.importacao.resumo(novas, repetidas, transf)}</p>

        <ul className="flex flex-col">
          {linhas.map((l) => {
            const bloqueada = l.repetida || l.sugestao?.tipo === "ja_registrada";
            const ativa = acaoDaLinha(l) === "importar";
            const s = l.sugestao;
            const categoriasDoTipo = l.tipo === "investimento" ? catInvest : catGasto;
            return (
              <li
                key={l.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[auto_8.5rem_minmax(0,1fr)_9rem_10rem_8rem] ${ativa ? "" : "opacity-60"}`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--primary)]"
                  checked={ativa}
                  disabled={bloqueada || gravando}
                  onChange={(e) => alterar(l.id, { incluir: e.target.checked })}
                  aria-label={t.importacao.incluir(l.descricao)}
                />
                <input type="date" aria-label={t.importacao.data} value={l.data} disabled={bloqueada || gravando}
                  onChange={(e) => e.target.value && alterar(l.id, { data: e.target.value })}
                  className={`${campo} num [color-scheme:dark]`} />
                <input aria-label={t.importacao.descricao} value={l.descricao} maxLength={200} disabled={bloqueada || gravando}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })}
                  className={`${campo} col-span-3 max-md:order-2 md:col-span-1`} />
                <div className="col-span-3 grid grid-cols-2 gap-2 max-md:order-3 md:contents">
                  <select aria-label={t.importacao.tipo} className={select} value={l.tipo} disabled={bloqueada || gravando}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoLinha;
                      alterar(l.id, { tipo, categoriaId: categoriaPara(tipo, l.descricao), transfConfirmada: tipo === "transferencia" && l.transfConfirmada });
                    }}>
                    {TIPOS.map((tp) => <option key={tp} value={tp}>{t.importacao.tipos[tp]}</option>)}
                  </select>
                  {l.tipo === "transferencia" ? (
                    <select aria-label={t.importacao.outraConta} className={select} value={l.outraContaId ?? ""} disabled={bloqueada || gravando}
                      onChange={(e) => alterar(l.id, { outraContaId: e.target.value || null })}>
                      <option value="">{t.importacao.outraConta}</option>
                      {contas.filter((c) => c.id !== conta.id && c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  ) : l.tipo === "entrada" ? (
                    <span />
                  ) : (
                    <select aria-label={t.lanc.categoria} className={select} value={l.categoriaId ?? ""} disabled={bloqueada || gravando}
                      onChange={(e) => alterar(l.id, { categoriaId: e.target.value || null })}>
                      <option value="">{t.lanc.semCategoria}</option>
                      {categoriasDoTipo.filter((c) => !c.oculta || c.id === l.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                </div>
                <span className={`num text-right font-medium whitespace-nowrap ${l.centavos >= 0 ? "text-success" : "text-danger"}`}>
                  {l.centavos >= 0 ? "+" : "−"}{fmt(Math.abs(l.centavos))}
                </span>

                {/* Avisos e sugestões da linha */}
                {(l.repetida || s || l.contaFixa) && (
                  <div className="order-last col-span-3 flex flex-col gap-1.5 text-[length:var(--fs-sm)] md:col-span-6 md:pl-7">
                    {l.repetida ? (
                      <span className="text-muted">{t.importacao.jaImportada}</span>
                    ) : s?.tipo === "ja_registrada" ? (
                      <span className="text-muted">{t.importacao.jaRegistrada}</span>
                    ) : null}
                    {!l.repetida && s && s.tipo !== "ja_registrada" && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-info/40 bg-info/10 px-2 py-1.5 text-text">
                        <ArrowRightLeft size={16} className="shrink-0 text-info" aria-hidden />
                        <span className="min-w-0 flex-1">
                          {l.transfConfirmada && s.tipo === "gravado"
                            ? t.importacao.conversao(
                                s.par.tabela === "entradas" ? t.importacao.tipos.entrada : t.importacao.tipos.gasto,
                                s.par.descricao,
                                diaMes(s.par.data),
                                nomeConta(l.centavos < 0 ? conta.id : s.outraContaId),
                                nomeConta(l.centavos < 0 ? s.outraContaId : conta.id),
                              )
                            : t.importacao.sugestaoTransf(
                                nomeConta(l.centavos < 0 ? conta.id : s.outraContaId),
                                nomeConta(l.centavos < 0 ? s.outraContaId : conta.id),
                              )}
                        </span>
                        <Button variante={l.transfConfirmada ? "fantasma" : "contorno"} className="h-8 px-3" disabled={gravando}
                          onClick={() =>
                            l.transfConfirmada
                              ? alterar(l.id, { transfConfirmada: false, tipo: sugerirTipo(l), categoriaId: categoriaPara(sugerirTipo(l), l.descricao) })
                              : alterar(l.id, { transfConfirmada: true, tipo: "transferencia", outraContaId: s.outraContaId, marcarPaga: false })
                          }>
                          {l.transfConfirmada ? t.importacao.recusarTransf : t.importacao.confirmarTransf}
                        </Button>
                      </div>
                    )}
                    {!bloqueada && l.contaFixa && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-text">
                        <Receipt size={16} className="shrink-0 text-warning" aria-hidden />
                        <span className="min-w-0 flex-1">
                          {l.marcarPaga ? t.importacao.marcadaPaga(l.contaFixa.descricao) : t.importacao.parecidaConta(l.contaFixa.descricao)}
                        </span>
                        <Button variante={l.marcarPaga ? "fantasma" : "contorno"} className="h-8 px-3" disabled={gravando}
                          onClick={() => alterar(l.id, { marcarPaga: !l.marcarPaga, incluir: true, transfConfirmada: false })}>
                          {l.marcarPaga ? t.importacao.desmarcarPaga : t.importacao.marcarPaga}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-20 flex flex-wrap items-center justify-end gap-3 border-t border-border bg-card pt-3 lg:bottom-0">
          {incompletas > 0 && <span className="mr-auto text-[length:var(--fs-sm)] text-warning">{t.importacao.outraConta}: {incompletas}</span>}
          <Button onClick={() => void confirmar(extrato, conta)} disabled={gravando || novas + linhas.filter((l) => acaoDaLinha(l) === "so_chave").length === 0 || incompletas > 0}>
            {gravando && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {gravando ? t.importacao.gravando : t.importacao.confirmar(novas)}
          </Button>
        </div>
      </Card>
    </div>
  );
}
