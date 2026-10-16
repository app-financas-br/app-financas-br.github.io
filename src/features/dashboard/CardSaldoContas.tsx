import { useState } from "react";
import { Link } from "react-router";
import { Landmark } from "lucide-react";
import { Card, CardTitle } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import { useContasBancarias, useSaldosContas } from "../contas-bancarias/api";
import { t } from "../../i18n/pt-BR";

const TODAS = "todas";

/** Saldo somado das contas ativas, com detalhe por conta e filtro "Todas as contas / uma conta". */
export function CardSaldoContas({ formatar, className = "" }: { formatar: (c: number) => string; className?: string }) {
  const contas = useContasBancarias();
  const saldos = useSaldosContas();
  const [filtro, setFiltro] = useState(TODAS);

  const ativas = (contas.data ?? []).filter((c) => c.ativa);
  const visiveis = filtro === TODAS ? ativas : ativas.filter((c) => c.id === filtro);
  const saldo = (id: string) => saldos.data?.get(id) ?? 0;
  const total = visiveis.reduce((s, c) => s + saldo(c.id), 0);

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <Landmark size={18} className="text-info" aria-hidden />
        <CardTitle className="mr-auto">{t.contas.saldoTitulo}</CardTitle>
        {ativas.length > 1 && (
          <select
            aria-label={t.contas.filtro}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-8 max-w-[9rem] cursor-pointer truncate rounded-md border border-border bg-input px-2 text-[length:var(--fs-sm)] text-text outline-none [&>option]:bg-elevated"
          >
            <option value={TODAS}>{t.contas.todas}</option>
            {ativas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
      </div>
      {contas.isError || saldos.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-danger">{t.contas.erro}</p>
          <Button variante="contorno" className="h-9" onClick={() => { contas.refetch(); saldos.refetch(); }}>{t.dashboard.tentarDeNovo}</Button>
        </div>
      ) : contas.isPending || saldos.isPending ? (
        <Skeleton className="h-28" />
      ) : ativas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-muted">{t.contas.semContas}</p>
          <Link to="/configuracoes" className="text-[length:var(--fs-sm)] text-primary-text hover:underline">{t.contas.cadastrar}</Link>
        </div>
      ) : (
        <>
          <p className={`num text-[length:var(--fs-xl)] font-semibold ${total < 0 ? "text-danger" : "text-text"}`}>{formatar(total)}</p>
          <ul className="flex flex-col">
            {visiveis.map((c) => (
              <li key={c.id} className="flex items-center gap-2 border-b border-border py-1.5 text-[length:var(--fs-sm)] last:border-b-0">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                <span className="min-w-0 flex-1 truncate text-text">
                  {c.nome}
                  {c.banco && c.banco !== c.nome && <span className="text-muted"> · {c.banco}</span>}
                </span>
                <span className={`num font-medium ${saldo(c.id) < 0 ? "text-danger" : "text-text"}`}>{formatar(saldo(c.id))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
