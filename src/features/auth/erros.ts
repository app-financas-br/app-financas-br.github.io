import { isAuthError } from "@supabase/supabase-js";
import { t } from "../../i18n/pt-BR";

type DetalheErro = { name: string; status: number | null; code: string | null; message: string };

function detalhar(erro: unknown): DetalheErro {
  if (isAuthError(erro)) {
    return { name: erro.name, status: erro.status ?? null, code: erro.code ?? null, message: erro.message };
  }
  if (erro instanceof Error) return { name: erro.name, status: null, code: null, message: erro.message };
  return { name: typeof erro, status: null, code: null, message: String(erro) };
}

/** Traduz erros do Supabase Auth para mensagens amigáveis em pt-BR e registra o erro real no console. */
export function mensagemDeErro(erro: unknown): string {
  const d = detalhar(erro);
  console.error("[auth]", d);

  // "Sem conexão" só quando o navegador diz que está offline.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return t.erros.semConexao;

  switch (d.code) {
    case "invalid_credentials":
      return t.erros.credenciais;
    case "user_already_exists":
    case "email_exists":
      return t.erros.jaCadastrado;
    case "email_not_confirmed":
      return t.erros.emailNaoConfirmado;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return t.erros.muitasTentativas;
    case "signup_disabled":
      return t.erros.cadastroDesligado;
    case "weak_password":
      return t.erros.senhaFraca;
    case "same_password":
      return t.erros.mesmaSenha;
  }

  return t.erros.generico(d.code ?? (d.status != null ? `HTTP ${d.status}` : d.name));
}
