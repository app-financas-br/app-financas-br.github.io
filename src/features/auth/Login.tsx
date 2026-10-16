import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { t } from "../../i18n/pt-BR";
import { AuthLayout } from "./AuthLayout";
import { Campo } from "../../components/ui/Campo";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { mensagemDeErro } from "./erros";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) setErro(mensagemDeErro(error));
      // Com sucesso, o AuthProvider recebe a sessão e as rotas levam ao dashboard.
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo={t.auth.tituloLogin} subtitulo={t.auth.subtituloLogin}>
      <form onSubmit={entrar} className="flex flex-col gap-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo rotulo={t.auth.email} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo rotulo={t.auth.senha} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div className="-mt-1 text-right">
          <Link to="/esqueci-senha" className="text-[length:var(--fs-sm)] text-primary-text hover:underline">
            {t.auth.esqueciSenha}
          </Link>
        </div>
        <Button type="submit" disabled={enviando}>
          {enviando ? t.auth.entrando : t.auth.entrar}
        </Button>
        <p className="text-center text-muted">
          {t.auth.naoTemConta}{" "}
          <Link to="/cadastro" className="text-primary-text hover:underline">
            {t.auth.criarConta}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
