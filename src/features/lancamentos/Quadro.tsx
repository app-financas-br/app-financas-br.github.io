import type { ReactNode } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Aviso } from "../../components/ui/Aviso";
import { formatarMoeda, type Moeda } from "../../lib/dinheiro";
import { IndicadorSalvamento } from "./celulas";
import { t } from "../../i18n/pt-BR";

export type Coluna = { rotulo: string; alinhar?: "direita" };
export type Total = { rotulo: string; centavos: number; cor?: string };

/**
 * Casca comum de Entradas, Contas fixas e Gastos: título, busca, adicionar,
 * cabeçalho (desktop), linhas, estados de carregando/vazio/erro e rodapé com totais.
 * `grade` é o grid-template-columns das linhas no desktop (md+).
 */
export function Quadro({
  titulo,
  busca,
  onBusca,
  onAdicionar,
  adicionando,
  estado,
  onTentarDeNovo,
  colunas,
  grade,
  totais,
  moeda,
  vazio,
  acaoCabecalho,
  children,
}: {
  /** Botão extra no cabeçalho (ex.: Replicar mês). */
  acaoCabecalho?: ReactNode;
  titulo: string;
  busca: string;
  onBusca: (v: string) => void;
  onAdicionar: () => void;
  adicionando: boolean;
  estado: "carregando" | "erro" | "vazio" | "ok";
  onTentarDeNovo: () => void;
  colunas: Coluna[];
  grade: string;
  totais: Total[];
  moeda: Moeda;
  vazio: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 !p-0">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 md:px-5 md:pt-5">
        <CardTitle className="mr-auto">{titulo}</CardTitle>
        <IndicadorSalvamento />
        <label className="relative flex w-full items-center sm:w-56">
          <Search size={16} className="pointer-events-none absolute left-3 text-faint" aria-hidden />
          <span className="sr-only">{t.lanc.buscar}</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder={t.lanc.buscar}
            className="h-10 w-full rounded-md border border-border bg-input pr-3 pl-9 text-text placeholder:text-faint focus:border-border-glow"
          />
        </label>
        {acaoCabecalho}
        <Button onClick={onAdicionar} disabled={adicionando || estado === "carregando"} className="h-10 max-sm:w-full">
          <Plus size={18} aria-hidden /> {t.lanc.adicionar}
        </Button>
      </div>

      {estado === "carregando" ? (
        <div className="flex flex-col gap-2 px-4 pb-4 md:px-5" aria-busy aria-label={t.carregando}>
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      ) : estado === "erro" ? (
        <div className="flex flex-col items-start gap-3 px-4 pb-4 md:px-5">
          <Aviso tipo="erro">{t.lanc.erroCarregar}</Aviso>
          <Button variante="contorno" onClick={onTentarDeNovo}>
            {t.dashboard.tentarDeNovo}
          </Button>
        </div>
      ) : estado === "vazio" ? (
        <p className="px-4 pb-6 text-center text-muted md:px-5">{vazio}</p>
      ) : (
        <div role="table" aria-label={titulo}>
          <div
            role="row"
            className="hidden border-b border-border px-5 pb-2 text-[length:var(--fs-xs)] font-semibold tracking-wide text-muted uppercase md:grid md:gap-2"
            style={{ gridTemplateColumns: grade }}
          >
            {colunas.map((c, i) => (
              <span role="columnheader" key={i} className={`px-2 ${c.alinhar === "direita" ? "text-right" : ""}`}>
                {c.rotulo}
              </span>
            ))}
          </div>
          <div role="rowgroup">{children}</div>
        </div>
      )}

      {estado !== "carregando" && estado !== "erro" && (
        <dl className="grid grid-cols-3 gap-2 border-t border-border px-4 py-3 md:px-5">
          {totais.map((tot) => (
            <div key={tot.rotulo} className="flex flex-col">
              <dt className="text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{tot.rotulo}</dt>
              <dd className={`num font-semibold ${tot.cor ?? "text-text"}`}>{formatarMoeda(tot.centavos, moeda)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/**
 * Linha: no celular, descrição + valor em cima e o resto embaixo;
 * no desktop (md+), todas as células na grade do cabeçalho.
 */
export function Linha({
  grade,
  descricao,
  valor,
  extras,
  acoes,
  onExcluir,
}: {
  grade: string;
  descricao: ReactNode;
  valor: ReactNode;
  /** Células do meio, na ordem das colunas entre descrição e valor. */
  extras: ReactNode;
  /** Botões extras ao lado do excluir (ex.: parcelar). */
  acoes?: ReactNode;
  onExcluir: () => void;
}) {
  return (
    <div
      role="row"
      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1 gap-y-1 border-b border-border px-2 py-2 transition-colors duration-150 ease-app last:border-b-0 hover:bg-card-hover/40 md:[grid-template-columns:var(--grade)] md:gap-2 md:px-3 md:py-1"
      style={{ ["--grade" as string]: grade }}
    >
      <div role="cell" className="min-w-0">{descricao}</div>
      {/* No celular, as células do meio vão para a 2ª linha; no desktop, entram na grade */}
      <div className="order-last col-span-3 flex flex-wrap items-center gap-2 md:order-none md:col-span-1 md:contents">
        {extras}
      </div>
      <div role="cell" className="min-w-[6.5rem]">{valor}</div>
      <div role="cell" className="flex justify-end">
        {acoes}
        <button
          type="button"
          onClick={onExcluir}
          aria-label={t.lanc.excluir}
          className="flex h-9 w-9 items-center justify-center rounded-md text-faint transition-colors duration-150 ease-app hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/** Botão de ícone para a coluna de ações da linha. */
export function BotaoAcao({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-9 w-9 items-center justify-center rounded-md text-faint transition-colors duration-150 ease-app hover:bg-primary-soft hover:text-primary-text"
    >
      {children}
    </button>
  );
}

/** Célula do meio (data, status, categoria…). */
export function Celula({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="cell" className={`min-w-0 ${className}`}>
      {children}
    </div>
  );
}
