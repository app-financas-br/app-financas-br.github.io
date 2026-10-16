import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "contorno" | "fantasma";

const estilos: Record<Variante, string> = {
  primario:
    "bg-primary text-app font-semibold hover:bg-primary-strong disabled:opacity-50",
  contorno:
    "border border-primary text-primary-text bg-transparent hover:bg-primary-soft disabled:opacity-50",
  fantasma: "text-muted hover:text-text hover:bg-card-hover disabled:opacity-50",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante };

export function Button({ variante = "primario", className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-[length:var(--fs-md)] transition-colors duration-200 ease-app disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
      {...props}
    />
  );
}
