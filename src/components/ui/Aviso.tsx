import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

/** Mensagem curta de sucesso ou erro, anunciada para leitores de tela. */
export function Aviso({ tipo, children }: { tipo: "erro" | "sucesso"; children: ReactNode }) {
  const erro = tipo === "erro";
  return (
    <div
      role={erro ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-[length:var(--fs-md)] ${
        erro ? "border-danger/40 bg-danger/10 text-danger" : "border-success/40 bg-success/10 text-success"
      }`}
    >
      {erro ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <CircleCheck size={18} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}
