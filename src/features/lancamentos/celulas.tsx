import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { RascunhoData } from "./rascunhoData";
import { useIsMutating } from "@tanstack/react-query";
import { Check, CloudOff, Loader2 } from "lucide-react";
import { formatarMoeda, paraCentavos, parseValor, deCentavos, type Moeda } from "../../lib/dinheiro";
import type { Categoria } from "../categorias/useCategorias";
import { t } from "../../i18n/pt-BR";

const campoBase =
  "h-9 w-full rounded-md border border-border-glow bg-input px-2 text-text outline-none";
const leitura =
  "flex h-9 w-full items-center truncate rounded-md px-2 text-left transition-colors duration-150 ease-app hover:bg-card-hover";

/** Texto que vira campo ao clicar; salva ao sair (ou Enter), Esc cancela. */
export function CelulaTexto({
  valor,
  onSalvar,
  rotulo,
  abrirAoMontar = false,
  maxLength = 120,
}: {
  valor: string;
  onSalvar: (novo: string) => void;
  rotulo: string;
  abrirAoMontar?: boolean;
  maxLength?: number;
}) {
  const [editando, setEditando] = useState(abrirAoMontar);
  const [rascunho, setRascunho] = useState(valor);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) input.current?.select();
  }, [editando]);

  const salvar = () => {
    setEditando(false);
    const limpo = rascunho.trim();
    if (limpo && limpo !== valor) onSalvar(limpo);
    else setRascunho(valor);
  };

  if (!editando) {
    return (
      <button type="button" className={`${leitura} text-text`} onClick={() => { setRascunho(valor); setEditando(true); }} aria-label={`${rotulo}: ${valor}`}>
        {valor}
      </button>
    );
  }
  return (
    <input
      ref={input}
      aria-label={rotulo}
      className={campoBase}
      value={rascunho}
      maxLength={maxLength}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setRascunho(valor); setEditando(false); }
      }}
    />
  );
}

/** Valor em dinheiro: mostra formatado, edita aceitando "1.234,56". */
export function CelulaValor({
  valor,
  onSalvar,
  moeda,
  rotulo,
  classeCor = "text-text",
}: {
  valor: number | string;
  onSalvar: (reais: number) => void;
  moeda: Moeda;
  rotulo: string;
  classeCor?: string;
}) {
  const centavos = paraCentavos(valor);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [invalido, setInvalido] = useState(false);

  const abrir = () => {
    setRascunho((centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setInvalido(false);
    setEditando(true);
  };
  const salvar = () => {
    const novo = parseValor(rascunho);
    if (novo === null || novo < 0) {
      setInvalido(true);
      return;
    }
    setEditando(false);
    if (novo !== centavos) onSalvar(deCentavos(novo));
  };

  if (!editando) {
    return (
      <button type="button" onClick={abrir} className={`${leitura} num justify-end font-medium ${classeCor}`} aria-label={`${rotulo}: ${formatarMoeda(centavos, moeda)}`}>
        {formatarMoeda(centavos, moeda)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      inputMode="decimal"
      aria-label={rotulo}
      aria-invalid={invalido}
      onFocus={(e) => e.currentTarget.select()}
      className={`${campoBase} num text-right ${invalido ? "border-danger" : ""}`}
      value={rascunho}
      onChange={(e) => { setRascunho(e.target.value); setInvalido(false); }}
      onBlur={salvar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setEditando(false);
      }}
    />
  );
}

/**
 * Data AAAA-MM-DD com o seletor nativo (sem conversão de fuso).
 * Salva só com data completa e válida (após uma pausa) ou ao sair do campo — ver RascunhoData.
 */
export function CelulaData({ valor, onSalvar, rotulo }: { valor: string | null; onSalvar: (nova: string | null) => void; rotulo: string }) {
  const [, redesenhar] = useReducer((x: number) => x + 1, 0);
  const salvarAtual = useRef(onSalvar);
  salvarAtual.current = onSalvar;
  const [controle] = useState(() => new RascunhoData(valor, (v) => salvarAtual.current(v), 800, redesenhar));

  useEffect(() => controle.sincronizar(valor), [controle, valor]);
  useEffect(() => () => controle.encerrar(), [controle]);

  return (
    <input
      type="date"
      aria-label={rotulo}
      value={controle.rascunho}
      onFocus={() => controle.focar()}
      onChange={(e) => controle.alterar(e.target.value)}
      onBlur={() => controle.sair()}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="num h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-muted [color-scheme:dark] hover:bg-card-hover focus:border-border-glow focus:text-text"
    />
  );
}

export type CorPill = "verde" | "laranja" | "vermelho" | "neutra";
const coresPill: Record<CorPill, string> = {
  verde: "border-success/40 bg-success/10 text-success",
  laranja: "border-warning/40 bg-warning/10 text-warning",
  vermelho: "border-danger/40 bg-danger/10 text-danger",
  neutra: "border-border-strong bg-card-hover text-muted",
};

/** Pílula clicável (status, forma de pagamento). Sempre com texto: cor nunca é o único sinal. */
export function Pill({ cor, children, onClick, rotulo }: { cor: CorPill; children: ReactNode; onClick?: () => void; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className={`inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border px-3 text-[length:var(--fs-sm)] font-medium transition-opacity duration-150 ease-app hover:opacity-80 ${coresPill[cor]}`}
    >
      {children}
    </button>
  );
}

export function SelectCategoria({
  valor,
  categorias,
  onSalvar,
}: {
  valor: string | null;
  categorias: Categoria[];
  onSalvar: (id: string) => void;
}) {
  const atual = categorias.find((c) => c.id === valor);
  return (
    <div className="relative flex h-9 w-full items-center rounded-md hover:bg-card-hover">
      <span aria-hidden className="ml-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: atual?.cor ?? "var(--chart-7)" }} />
      <select
        aria-label={t.lanc.categoria}
        value={valor ?? ""}
        onChange={(e) => e.target.value && onSalvar(e.target.value)}
        className="h-9 w-full cursor-pointer appearance-none truncate bg-transparent pr-2 pl-2 text-text outline-none [&>option]:bg-elevated"
      >
        {!atual && <option value="">{t.lanc.semCategoria}</option>}
        {categorias
          .filter((c) => !c.oculta || c.id === valor)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
      </select>
    </div>
  );
}

/** "Salvando… / Salvo / Sem conexão" no topo das tabelas. */
export function IndicadorSalvamento() {
  const salvando = useIsMutating({ mutationKey: ["salvar"] });
  const [online, setOnline] = useState(() => navigator.onLine);
  const [jaSalvou, setJaSalvou] = useState(false);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (salvando > 0) setJaSalvou(true);
  }, [salvando]);

  let conteudo: ReactNode = null;
  if (!online) conteudo = (<><CloudOff size={14} aria-hidden /> {t.lanc.semConexao}</>);
  else if (salvando > 0) conteudo = (<><Loader2 size={14} className="animate-spin" aria-hidden /> {t.lanc.salvando}</>);
  else if (jaSalvou) conteudo = (<><Check size={14} aria-hidden /> {t.lanc.salvo}</>);

  return (
    <span role="status" className={`flex items-center gap-1.5 text-[length:var(--fs-sm)] ${online ? "text-muted" : "text-warning"}`}>
      {conteudo}
    </span>
  );
}
