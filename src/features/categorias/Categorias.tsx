import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { Aviso } from "../../components/ui/Aviso";
import { useToast } from "../../components/ui/Toast";
import { CelulaTexto } from "../lancamentos/celulas";
import { corLivre, nomeLivre, nomeRepetido } from "./regrasCategoria";
import {
  ehCategoriaReserva,
  useAtualizarCategoria,
  useCategorias,
  useCriarCategoria,
  type Categoria,
} from "./useCategorias";
import { useGrupos, type GrupoPlanejamento } from "../planejamento/api";
import { t } from "../../i18n/pt-BR";

/** Grupo do planejamento a que a categoria pertence ("Sem grupo" = fica fora do previsto × realizado). */
function SelectGrupo({ categoria, grupos, onSalvar }: { categoria: Categoria; grupos: GrupoPlanejamento[]; onSalvar: (id: string | null) => void }) {
  const atual = grupos.find((g) => g.id === categoria.grupo_id);
  return (
    <div className="relative flex h-9 w-28 shrink-0 items-center rounded-md hover:bg-card-hover sm:w-44">
      <span aria-hidden className="ml-2 h-2 w-2 shrink-0 rounded-sm" style={{ background: atual?.cor ?? "var(--border-strong)" }} />
      <select
        aria-label={t.categorias.grupo(categoria.nome)}
        value={atual?.id ?? ""}
        onChange={(e) => onSalvar(e.target.value || null)}
        className="h-9 w-full cursor-pointer appearance-none truncate bg-transparent pr-1 pl-2 text-[length:var(--fs-sm)] text-muted outline-none [&>option]:bg-elevated"
      >
        <option value="">{t.categorias.semGrupo}</option>
        {grupos.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nome}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Seletor de cor: o arrastar do seletor gera muitos eventos, então grava após uma pausa. */
export function CorCategoria({ cor, nome, onSalvar }: { cor: string; nome: string; onSalvar: (cor: string) => void }) {
  const [local, setLocal] = useState(cor);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(cor), [cor]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <input
      type="color"
      value={local}
      aria-label={t.categorias.cor(nome)}
      onChange={(e) => {
        const nova = e.target.value;
        setLocal(nova);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => nova !== cor && onSalvar(nova), 400);
      }}
      className="h-8 w-8 shrink-0 cursor-pointer rounded-full border border-border bg-transparent p-0.5 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
    />
  );
}

function Grupo({ tipo, categorias }: { tipo: Categoria["tipo"]; categorias: Categoria[] }) {
  const { mostrar } = useToast();
  const atualizar = useAtualizarCategoria();
  const criar = useCriarCategoria();
  const { data: grupos = [] } = useGrupos();
  const [novoId, setNovoId] = useState<string | null>(null);

  const doTipo = categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.ordem - b.ordem);
  const visiveis = doTipo.filter((c) => !c.oculta);
  const ocultas = doTipo.filter((c) => c.oculta);

  const erro = (e: unknown) => {
    console.error("[categorias]", e);
    mostrar({ tipo: "erro", texto: (e as { code?: string }).code === "23505" ? t.categorias.nomeRepetido : t.lanc.erroSalvar });
  };
  const salvar = (id: string, campos: Parameters<typeof atualizar.mutate>[0]["campos"]) =>
    atualizar.mutate({ id, campos }, { onError: erro });

  /** Renomear: recusa no app o nome que já existe (ignorando caixa/acento); o banco garante o mesmo. */
  const renomear = (c: Categoria, nome: string) => {
    if (nomeRepetido(nome, doTipo, c.id)) {
      mostrar({ tipo: "erro", texto: t.categorias.nomeRepetido });
      return;
    }
    salvar(c.id, { nome });
  };

  const adicionar = () => {
    // Fica antes de "Outros" (ordem 99), que é sempre a última
    const ordem = Math.max(0, ...doTipo.filter((c) => c.ordem < 99).map((c) => c.ordem)) + 1;
    criar.mutate(
      {
        tipo,
        nome: nomeLivre(t.categorias.nova, doTipo.map((c) => c.nome)),
        // Cor que nenhuma outra categoria (de gasto ou investimento) usa
        cor: corLivre(categorias.map((c) => c.cor)),
        ordem,
      },
      { onSuccess: (c) => setNovoId(c.id), onError: erro },
    );
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CardTitle className="mr-auto">{tipo === "gasto" ? t.categorias.deGasto : t.categorias.deInvestimento}</CardTitle>
        <Button variante="contorno" className="h-9" onClick={adicionar} disabled={criar.isPending}>
          <Plus size={16} aria-hidden /> {t.categorias.adicionar}
        </Button>
      </div>

      <ul className="flex flex-col">
        {visiveis.map((c) => (
          <li key={c.id} className="flex items-center gap-2 border-b border-border py-1.5 last:border-b-0">
            <CorCategoria cor={c.cor} nome={c.nome} onSalvar={(cor) => salvar(c.id, { cor })} />
            <div className="min-w-0 flex-1">
              {ehCategoriaReserva(c) ? (
                <span className="flex h-9 items-center px-2 text-text">{c.nome}</span>
              ) : (
                <CelulaTexto
                  rotulo={t.categorias.nome}
                  valor={c.nome}
                  maxLength={40}
                  abrirAoMontar={c.id === novoId}
                  onSalvar={(nome) => renomear(c, nome)}
                />
              )}
            </div>
            <SelectGrupo categoria={c} grupos={grupos} onSalvar={(grupo_id) => salvar(c.id, { grupo_id })} />
            {c.palavras.length > 0 && (
              <span className="hidden text-[length:var(--fs-xs)] text-faint sm:inline" title={c.palavras.join(", ")}>
                {t.categorias.palavras(c.palavras.length)}
              </span>
            )}
            {ehCategoriaReserva(c) ? (
              <span className="px-2 text-[length:var(--fs-xs)] text-faint" title={t.categorias.reservaExplicacao}>
                {t.categorias.reserva}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => salvar(c.id, { oculta: true })}
                aria-label={t.categorias.ocultar(c.nome)}
                title={t.categorias.ocultar(c.nome)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-faint hover:bg-card-hover hover:text-text"
              >
                <EyeOff size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {ocultas.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="text-[length:var(--fs-xs)] tracking-wide text-muted uppercase">{t.categorias.ocultas}</p>
          {ocultas.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-1 text-muted">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full opacity-50" style={{ background: c.cor }} />
              <span className="flex-1 truncate line-through">{c.nome}</span>
              <Button variante="fantasma" className="h-8 px-2" onClick={() => salvar(c.id, { oculta: false })}>
                <Eye size={16} aria-hidden /> {t.categorias.restaurar}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Categorias() {
  const { data, isPending, isError, refetch } = useCategorias();

  if (isPending) {
    return (
      <div className="grid gap-[var(--gap-grid)] lg:grid-cols-2" aria-busy aria-label={t.carregando}>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (isError) {
    return (
      <Card className="flex flex-col items-start gap-3">
        <Aviso tipo="erro">{t.dashboard.erroCategorias}</Aviso>
        <Button variante="contorno" onClick={() => refetch()}>
          {t.dashboard.tentarDeNovo}
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-[var(--gap-grid)] lg:grid-cols-2">
      <Grupo tipo="gasto" categorias={data} />
      <Grupo tipo="investimento" categorias={data} />
    </div>
  );
}
