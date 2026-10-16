import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { t } from "../../i18n/pt-BR";

type Props = InputHTMLAttributes<HTMLInputElement> & { rotulo: string };

/** Campo de formulário com rótulo. Em type="password" mostra o botão de ver a senha. */
export function Campo({ rotulo, type = "text", className = "", ...props }: Props) {
  const id = useId();
  const [ver, setVer] = useState(false);
  const ehSenha = type === "password";

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[length:var(--fs-sm)] font-medium text-muted">
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={id}
          type={ehSenha && ver ? "text" : type}
          className="h-11 w-full rounded-md border border-border bg-input px-3 text-text placeholder:text-faint transition-colors duration-200 ease-app focus:border-border-glow"
          {...props}
        />
        {ehSenha && (
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? t.auth.ocultarSenha : t.auth.mostrarSenha}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-text"
          >
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
