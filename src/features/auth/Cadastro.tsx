import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { supabase, urlDoApp } from "../../lib/supabase";
import { t } from "../../i18n/pt-BR";
import { AuthLayout } from "./AuthLayout";
import { Campo } from "../../components/ui/Campo";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { mensagemDeErro } from "./erros";

export const SENHA_MINIMA = 8;

export function Cadastro() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) return setErro(t.auth.senhaCurta);
    if (senha !== confirmar) return setErro(t.auth.senhasDiferentes);

    setEnviando(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: { emailRedirectTo: urlDoApp() },
      });
      if (error) setErro(mensagemDeErro(error));
      // Sem sessão = o projeto exige confirmar o e-mail. Com sessão, as rotas levam ao dashboard.
      else if (!data.session) setSucesso(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo={t.auth.tituloCadastro} subtitulo={t.auth.subtituloCadastro}>
      {sucesso ? (
        <div className="flex flex-col gap-4">
          <Aviso tipo="sucesso">{t.auth.confiraEmail}</Aviso>
          <Link to="/login" className="text-center text-primary-text hover:underline">
            {t.auth.voltarLogin}
          </Link>
        </div>
      ) : (
        <form onSubmit={criar} className="flex flex-col gap-4">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Campo rotulo={t.auth.email} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo rotulo={t.auth.senha} type="password" autoComplete="new-password" required minLength={SENHA_MINIMA} value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Campo rotulo={t.auth.confirmarSenha} type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          <Button type="submit" disabled={enviando}>
            {enviando ? t.auth.criando : t.auth.criarConta}
          </Button>
          <p className="text-center text-muted">
            {t.auth.jaTemConta}{" "}
            <Link to="/login" className="text-primary-text hover:underline">
              {t.auth.entrar}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
