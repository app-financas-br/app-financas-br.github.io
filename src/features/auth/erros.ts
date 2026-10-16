import { isAuthError } from "@supabase/supabase-js";
import { t } from "../../i18n/pt-BR";

/** Traduz erros do Supabase Auth para mensagens amigáveis em pt-BR. */
export function mensagemDeErro(erro: unknown): string {
  if (isAuthError(erro)) {
    switch (erro.code) {
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
    if (erro.status === 0) return t.erros.semConexao;
  }
  if (erro instanceof TypeError) return t.erros.semConexao; // fetch falhou
  return t.erros.generico;
}
