import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Plus, Square, Trash2 } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { usePeriodo } from "../../app/providers/PeriodoProvider";
import { useCategorias, useSalvarRegra } from "../categorias/useCategorias";
import { useContasBancarias } from "../contas-bancarias/api";
import { usePreferencias } from "../preferencias/usePreferencias";
import { supabase } from "../../lib/supabase";
import { formatarMovimento, formatarMoeda, parseValor } from "../../lib/dinheiro";
import { dataPadrao } from "../../lib/datas";
import { regraDoCartao, sugerirFatura } from "../../lib/fatura";
import { EscolhaFatura, nomeFatura } from "../lancamentos/EscolhaFatura";
import { itensParaLinhas, montarInsercao, totalPrevisto, type FormaVoz, type LinhaVoz, type TipoVoz } from "../../lib/voz";
import { enviarVoz } from "./api";
import { MAX_SEGUNDOS, useGravador } from "./gravador";
import { t } from "../../i18n/pt-BR";

const Contexto = createContext<{ abrir: () => void } | null>(null);

/** Abre o assistente de voz de qualquer tela (barra lateral, Dashboard, botão flutuante). */
export function useAssistenteVoz() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAssistenteVoz precisa estar dentro de <AssistenteVozProvider>");
  return ctx;
}

const TIPOS: TipoVoz[] = ["gasto", "entrada", "conta_fixa", "investimento"];
const FORMAS: FormaVoz[] = ["pix", "debito", "credito", "dinheiro"];
const COR_TIPO: Record<TipoVoz, string> = {
  gasto: "border-danger/40 text-danger",
  entrada: "border-success/40 text-success",
  conta_fixa: "border-warning/40 text-warning",
  investimento: "border-info/40 text-info",
};
const campo = "h-9 w-full min-w-0 rounded-md border border-border bg-input px-2 text-text outline-none focus:border-border-glow [&>option]:bg-elevated";
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

type Etapa = { nome: "gravando" } | { nome: "processando" } | { nome: "confirmar"; transcricao: string } | { nome: "erro"; mensagem: string } | { nome: "salvando" };

/** Campo de valor da linha: aceita "52,90", mostra formatado ao sair. */
function CampoValor({ centavos, onMudar, rotulo }: { centavos: number; onMudar: (c: number) => void; rotulo: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <input
      inputMode="decimal"
      aria-label={rotulo}
      className={`${campo} num text-right`}
      value={texto ?? (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      onFocus={(e) => { setTexto(e.target.value); e.target.select(); }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        const c = texto === null ? null : parseValor(texto);
        if (c !== null && c > 0) onMudar(c);
        setTexto(null);
      }}
    />
  );
}

function Painel({ onFechar }: { onFechar: () => void }) {
  const { ano, mes } = usePeriodo();
  const periodo = { ano, mes };
  const { prefs } = usePreferencias();
  const { mostrar } = useToast();
  const qc = useQueryClient();
  const salvarRegra = useSalvarRegra();
  const { data: categorias = [] } = useCategorias();
  const { data: contas = [] } = useContasBancarias();
  const cartoes = contas.filter((c) => c.ativa && c.tipo === "cartao_credito");
  const catGasto = categorias.filter((c) => c.tipo === "gasto" && !c.oculta);
  const catInvest = categorias.filter((c) => c.tipo === "investimento" && !c.oculta);
  const [etapa, setEtapa] = useState<Etapa>({ nome: "gravando" });
  const [linhas, setLinhas] = useState<LinhaVoz[]>([]);

  const processar = async (audio: Blob | null) => {
    if (!audio) return setEtapa({ nome: "erro", mensagem: t.vozPainel.erros.semAudio });
      setEtapa({ nome: "processando" });
      try {
        const r = await enviarVoz(audio, catGasto.map((c) => c.nome), catInvest.map((c) => c.nome));
        const novas = itensParaLinhas(r.itens, categorias, periodo).map((l) => ({
          ...l,
          cartaoId: l.forma === "credito" ? cartoes[0]?.id ?? null : null,
        }));
        setLinhas(novas);
        setEtapa({ nome: "confirmar", transcricao: r.transcricao });
      } catch (e) {
        setEtapa({ nome: "erro", mensagem: (e as Error).message });
      }
  };
  const gravador = useGravador(processar);

  // Começa a gravar ao abrir (a pessoa já clicou em "Gravar"); a ref evita gravar duas vezes
  const iniciou = useRef(false);
  const { iniciar, cancelar } = gravador;
  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    iniciar().catch(() => setEtapa({ nome: "erro", mensagem: t.vozPainel.erros.microfone }));
  }, [iniciar]);

  // Estável: o Modal refaz o foco quando onFechar muda, e o equalizador redesenha a cada quadro
  const fechar = useCallback(() => {
    cancelar();
    onFechar();
  }, [cancelar, onFechar]);
  const alterar = (id: string, campos: Partial<LinhaVoz>) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...campos } : l)));
  const adicionar = () =>
    setLinhas((ls) => [
      ...ls,
      {
        id: `n${Date.now()}`, tipo: "gasto", descricao: t.vozPainel.novoItem, centavos: 0, resgate: false,
        categoriaId: null, categoriaSugerida: null, parcelas: 1, forma: "pix", data: dataPadrao(periodo), cartaoId: null,
      },
    ]);

  const confirmar = async () => {
    const validas = linhas.filter((l) => l.centavos > 0);
    setEtapa({ nome: "salvando" });
    let gravadas = 0;
    try {
      for (const l of validas) {
        const cartao = l.tipo === "gasto" && l.forma === "credito" ? cartoes.find((c) => c.id === l.cartaoId) : undefined;
        const ins = montarInsercao(l, periodo, cartao && { id: cartao.id, nome: cartao.nome, regra: regraDoCartao(cartao) });
        const { data, error } = await supabase.from(ins.tabela).insert(ins.valores).select("id").single();
        if (error) throw error;
        if (ins.parcelas > 1 && (ins.tabela === "gastos_variaveis" || ins.tabela === "contas_fixas")) {
          const { error: e2 } = await supabase.rpc("parcelar_lancamento", { p_tabela: ins.tabela, p_id: data.id, p_parcelas: ins.parcelas });
          if (e2) throw e2;
        }
        // Trocou a categoria sugerida: vira regra para o mesmo nome
        if ((l.tipo === "gasto" || l.tipo === "conta_fixa") && l.categoriaId && l.categoriaId !== l.categoriaSugerida) {
          salvarRegra.mutate({ descricao: l.descricao, categoriaId: l.categoriaId });
        }
        gravadas++;
      }
      await qc.invalidateQueries();
      mostrar({ tipo: "info", texto: t.vozPainel.gravados(gravadas) });
      onFechar();
    } catch (e) {
      console.error("[voz] gravar", e);
      await qc.invalidateQueries();
      mostrar({ tipo: "erro", texto: t.vozPainel.erroGravar(gravadas) });
      // Tira da lista o que já foi gravado, para não duplicar ao tentar de novo
      setLinhas(validas.slice(gravadas));
      setEtapa({ nome: "confirmar", transcricao: "" });
    }
  };

  const total = useMemo(() => totalPrevisto(linhas), [linhas]);

  if (etapa.nome === "gravando" || etapa.nome === "processando") {
    const processando = etapa.nome === "processando";
    return (
      <Modal aberto titulo={t.vozPainel.titulo} onFechar={fechar}>
        <div className="flex flex-col items-center gap-4 py-2">
          <button
            type="button"
            onClick={gravador.parar}
            disabled={processando || !gravador.gravando}
            aria-label={t.vozPainel.parar}
            className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-primary shadow-[var(--glow-primary)] disabled:opacity-60"
          >
            {gravador.gravando && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-border-glow" />}
            {processando ? <Loader2 size={32} className="animate-spin" aria-hidden /> : gravador.gravando ? <Square size={28} aria-hidden /> : <Mic size={32} aria-hidden />}
          </button>
          <p className="num text-[length:var(--fs-lg)] text-text" aria-live="polite">
            {processando ? t.vozPainel.processando : `${mmss(gravador.segundos)} / ${mmss(MAX_SEGUNDOS)}`}
          </p>
          <div className="flex h-10 items-end gap-1" aria-hidden>
            {gravador.niveis.map((n, i) => (
              <span key={i} className="w-1.5 rounded-full bg-primary transition-[height] duration-75" style={{ height: `${Math.max(8, n * 100)}%` }} />
            ))}
          </div>
          <p className="min-h-[1.5em] text-center text-muted">{gravador.legenda || t.vozPainel.dica}</p>
          {!processando && <Button variante="fantasma" onClick={fechar}>{t.vozPainel.cancelar}</Button>}
        </div>
      </Modal>
    );
  }

  if (etapa.nome === "erro") {
    return (
      <Modal
        aberto
        titulo={t.vozPainel.titulo}
        onFechar={fechar}
        rodape={
          <>
            <Button variante="fantasma" onClick={fechar}>{t.vozPainel.fechar}</Button>
            <Button
              onClick={() => {
                setEtapa({ nome: "gravando" });
                iniciar().catch(() => setEtapa({ nome: "erro", mensagem: t.vozPainel.erros.microfone }));
              }}
            >
              {t.vozPainel.gravarDeNovo}
            </Button>
          </>
        }
      >
        <Aviso tipo="erro">{etapa.mensagem}</Aviso>
      </Modal>
    );
  }

  const salvando = etapa.nome === "salvando";
  const transcricao = etapa.nome === "confirmar" ? etapa.transcricao : "";
  return (
    <Modal
      aberto
      titulo={t.vozPainel.confirmarTitulo}
      onFechar={fechar}
      rodape={
        <>
          <Button variante="fantasma" onClick={fechar} disabled={salvando}>{t.vozPainel.cancelar}</Button>
          <Button onClick={() => void confirmar()} disabled={salvando || !linhas.some((l) => l.centavos > 0)}>
            {salvando && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {t.vozPainel.confirmar(linhas.filter((l) => l.centavos > 0).length)}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto">
        {transcricao && <p className="rounded-md bg-card-hover px-3 py-2 text-[length:var(--fs-sm)] text-muted">“{transcricao}”</p>}
        {linhas.length === 0 && <p className="text-muted">{t.vozPainel.nadaEntendido}</p>}
        <ul className="flex flex-col gap-3">
          {linhas.map((l) => {
            const cats = l.tipo === "investimento" ? catInvest : catGasto;
            return (
              <li key={l.id} className={`flex flex-col gap-2 rounded-md border bg-card p-2 ${COR_TIPO[l.tipo]}`}>
                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_2.25rem] items-center gap-2">
                  <select aria-label={t.vozPainel.tipo} className={campo} value={l.tipo} disabled={salvando}
                    onChange={(e) => alterar(l.id, { tipo: e.target.value as TipoVoz, categoriaId: null, resgate: false })}>
                    {TIPOS.map((tp) => <option key={tp} value={tp}>{t.vozPainel.tipos[tp]}</option>)}
                  </select>
                  <div className="min-w-0 text-text">
                    <CampoValor rotulo={t.vozPainel.valor} centavos={l.centavos} onMudar={(centavos) => alterar(l.id, { centavos })} />
                  </div>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-faint hover:text-danger"
                    onClick={() => setLinhas((ls) => ls.filter((x) => x.id !== l.id))} aria-label={t.vozPainel.remover(l.descricao)} disabled={salvando}>
                    <Trash2 size={16} />
                  </button>
                </div>
                <input aria-label={t.vozPainel.descricao} className={campo} value={l.descricao} maxLength={120} disabled={salvando}
                  onChange={(e) => alterar(l.id, { descricao: e.target.value })} />
                <div className="grid grid-cols-2 gap-2 text-text">
                  {l.tipo !== "entrada" && (
                    <select aria-label={t.lanc.categoria} className={campo} value={l.categoriaId ?? ""} disabled={salvando}
                      onChange={(e) => alterar(l.id, { categoriaId: e.target.value || null })}>
                      <option value="">{t.lanc.semCategoria}</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                  {l.tipo === "investimento" && (
                    <select aria-label={t.vozPainel.tipo} className={campo} value={l.resgate ? "r" : "a"} disabled={salvando}
                      onChange={(e) => alterar(l.id, { resgate: e.target.value === "r" })}>
                      <option value="a">{t.investimentos.aporte}</option>
                      <option value="r">{t.investimentos.resgate}</option>
                    </select>
                  )}
                  {(l.tipo === "gasto" || l.tipo === "conta_fixa") && (
                    <select aria-label={t.vozPainel.parcelas} className={campo} value={l.parcelas} disabled={salvando}
                      onChange={(e) => alterar(l.id, { parcelas: Number(e.target.value) })}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? t.vozPainel.aVista : `${n}x`}</option>)}
                    </select>
                  )}
                  {l.tipo === "gasto" && (
                    <select aria-label={t.lanc.pagamento} className={campo} value={l.forma === "nao_informado" ? "pix" : l.forma} disabled={salvando}
                      onChange={(e) => {
                        const forma = e.target.value as FormaVoz;
                        alterar(l.id, { forma, cartaoId: forma === "credito" ? l.cartaoId ?? cartoes[0]?.id ?? null : null, fatura: null });
                      }}>
                      {FORMAS.map((f) => <option key={f} value={f}>{t.lanc.formas[f as keyof typeof t.lanc.formas]}</option>)}
                    </select>
                  )}
                  {l.tipo === "gasto" && l.forma === "credito" && cartoes.length > 0 && (
                    <select aria-label={t.detalhes.cartaoCredito} className={campo} value={l.cartaoId ?? ""} disabled={salvando}
                      onChange={(e) => alterar(l.id, { cartaoId: e.target.value || null, fatura: null })}>
                      {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                  {l.tipo === "gasto" && l.forma === "credito" && (() => {
                    // Mês da fatura: a sugestão vem marcada (regra do cartão ou mês da compra) e pode ser trocada
                    const cartao = cartoes.find((c) => c.id === l.cartaoId);
                    const regra = cartao ? regraDoCartao(cartao) : null;
                    const sugestao = sugerirFatura(l.data, regra);
                    return (
                      <div className="col-span-2">
                        <EscolhaFatura
                          dataCompra={l.data}
                          valor={l.fatura ?? sugestao}
                          sugestao={sugestao}
                          aviso={regra && cartao ? t.fatura.sugestaoCartao(cartao.nome, nomeFatura(sugestao)) : t.fatura.semRegra}
                          onMudar={(fatura) => alterar(l.id, { fatura })}
                        />
                      </div>
                    );
                  })()}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-2">
          <Button variante="fantasma" className="h-9" onClick={adicionar} disabled={salvando}>
            <Plus size={16} aria-hidden /> {t.vozPainel.adicionar}
          </Button>
          <span className={`num font-semibold ${total < 0 ? "text-danger" : total > 0 ? "text-success" : "text-muted"}`}>
            {t.vozPainel.total} {total === 0 ? formatarMoeda(0, prefs.moeda) : formatarMovimento(total, prefs.moeda)}
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** Guarda o estado "aberto" e monta o painel só quando necessário (o microfone só liga ao abrir). */
export function AssistenteVozProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const abrir = useCallback(() => setAberto(true), []);
  const fechar = useCallback(() => setAberto(false), []);
  const valor = useMemo(() => ({ abrir }), [abrir]);
  return (
    <Contexto.Provider value={valor}>
      {children}
      {aberto && <Painel onFechar={fechar} />}
    </Contexto.Provider>
  );
}
