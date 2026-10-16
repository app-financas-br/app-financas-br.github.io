import { useId } from "react";
import { faturaDaOpcao, mesDaData, opcaoDaFatura, somarMeses } from "../../lib/fatura";
import { parseData, type Periodo } from "../../lib/datas";
import { t } from "../../i18n/pt-BR";

/** "novembro de 2026" */
export const nomeFatura = (p: Periodo) => `${t.meses[p.mes - 1]!.toLowerCase()} de ${p.ano}`;
/** "16/10" */
export const diaMes = (data: string) => parseData(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const chave = (p: Periodo) => `${p.ano}-${p.mes}`;

/**
 * Escolha do mês da fatura de um gasto no crédito: dois botões rápidos ("Paga este mês" /
 * "Paga mês que vem") e o campo "Fatura de" para qualquer outro mês. A data da compra não muda.
 */
export function EscolhaFatura({
  dataCompra,
  valor,
  sugestao,
  aviso,
  mostrarResumo = true,
  onMudar,
}: {
  dataCompra: string;
  valor: Periodo;
  /** Mês sugerido (regra do cartão ou o mês da compra). */
  sugestao: Periodo;
  /** Explica de onde veio a sugestão. */
  aviso?: string;
  mostrarResumo?: boolean;
  onMudar: (p: Periodo) => void;
}) {
  const idSelect = useId();
  const opcao = opcaoDaFatura(dataCompra, valor);
  const opcaoSugerida = opcaoDaFatura(dataCompra, sugestao);
  const base = mesDaData(dataCompra);
  const meses = Array.from({ length: 14 }, (_, i) => somarMeses(base, i - 1));
  if (!meses.some((m) => chave(m) === chave(valor))) meses.push(valor);
  meses.sort((a, b) => a.ano * 12 + a.mes - (b.ano * 12 + b.mes));

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-[length:var(--fs-sm)] font-medium text-muted">{t.fatura.titulo}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["este", "proximo"] as const).map((o) => {
          const marcado = opcao === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={marcado}
              onClick={() => onMudar(faturaDaOpcao(dataCompra, o))}
              className={`flex min-h-11 min-w-0 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left transition-colors ${
                marcado ? "border-border-glow bg-primary-soft text-text" : "border-border bg-input text-muted hover:text-text"
              }`}
            >
              <span className="text-[length:var(--fs-sm)] font-medium">{o === "este" ? t.fatura.este : t.fatura.proximo}</span>
              <span className="truncate text-[length:var(--fs-xs)] text-faint">
                {t.meses[faturaDaOpcao(dataCompra, o).mes - 1]}
                {opcaoSugerida === o && ` · ${t.fatura.sugerido}`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={idSelect} className="shrink-0 text-[length:var(--fs-sm)] text-muted">
          {t.fatura.faturaDe}
        </label>
        <select
          id={idSelect}
          value={chave(valor)}
          onChange={(e) => onMudar(meses.find((m) => chave(m) === e.target.value)!)}
          className="h-10 min-w-0 flex-1 cursor-pointer rounded-md border border-border bg-input px-3 text-text focus:border-border-glow [&>option]:bg-elevated"
        >
          {meses.map((m) => (
            <option key={chave(m)} value={chave(m)}>
              {t.meses[m.mes - 1]} {m.ano}
            </option>
          ))}
        </select>
      </div>
      {mostrarResumo && <p className="num text-[length:var(--fs-sm)] text-text">{t.fatura.compraConta(diaMes(dataCompra), nomeFatura(valor))}</p>}
      {aviso && <p className="text-[length:var(--fs-xs)] text-faint">{aviso}</p>}
    </fieldset>
  );
}
