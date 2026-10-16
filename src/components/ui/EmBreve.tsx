import { Construction } from "lucide-react";
import { Card, CardTitle } from "./Card";
import { t } from "../../i18n/pt-BR";

export function EmBreve({ fase }: { fase: number }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-soft text-primary">
        <Construction size={22} aria-hidden />
      </span>
      <CardTitle>{t.emBreve.titulo}</CardTitle>
      <p className="text-muted">{t.emBreve.texto(fase)}</p>
    </Card>
  );
}
