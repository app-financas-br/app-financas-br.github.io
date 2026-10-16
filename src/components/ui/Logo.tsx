import { Wallet } from "lucide-react";
import { t } from "../../i18n/pt-BR";

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary shadow-[var(--glow-primary)]">
        <Wallet size={20} />
      </span>
      <span className="text-[length:var(--fs-lg)] font-semibold text-text">{t.app.nome}</span>
    </div>
  );
}
