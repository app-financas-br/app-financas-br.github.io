import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { supabase, urlDoApp } from "../../lib/supabase";
import { t } from "../../i18n/pt-BR";
import { AuthLayout } from "./AuthLayout";
import { Campo } from "../../components/ui/Campo";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { mensagemDeErro } from "./erros";

export function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      // O link volta para o app com ?code=...; o AuthProvider recebe PASSWORD_RECOVERY
      // e o App mostra a tela de nova senha.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlDoApp() });
      if (error) setErro(mensagemDeErro(error));
      else setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo={t.auth.tituloEsqueci} subtitulo={t.auth.subtituloEsqueci}>
      <form onSubmit={enviar} className="flex flex-col gap-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {enviado ? (
          <Aviso tipo="sucesso">{t.auth.linkEnviado}</Aviso>
        ) : (
          <>
            <Campo rotulo={t.auth.email} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={enviando}>
              {enviando ? t.auth.enviando : t.auth.enviar}
            </Button>
          </>
        )}
        <Link to="/login" className="text-center text-primary-text hover:underline">
          {t.auth.voltarLogin}
        </Link>
      </form>
    </AuthLayout>
  );
}
