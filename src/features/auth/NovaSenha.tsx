import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { t } from "../../i18n/pt-BR";
import { useAuth } from "../../app/providers/AuthProvider";
import { AuthLayout } from "./AuthLayout";
import { Campo } from "../../components/ui/Campo";
import { Button } from "../../components/ui/Button";
import { Aviso } from "../../components/ui/Aviso";
import { mensagemDeErro } from "./erros";
import { SENHA_MINIMA } from "./Cadastro";

/** Aparece depois do evento PASSWORD_RECOVERY (link do e-mail de recuperação). */
export function NovaSenha() {
  const { concluirRecuperacao } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) return setErro(t.auth.senhaCurta);
    if (senha !== confirmar) return setErro(t.auth.senhasDiferentes);

    setEnviando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) return setErro(mensagemDeErro(error));
      concluirRecuperacao();
      navigate("/", { replace: true, state: { aviso: t.auth.senhaAlterada } });
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout titulo={t.auth.tituloNovaSenha} subtitulo={t.auth.subtituloNovaSenha}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Campo rotulo={t.auth.novaSenha} type="password" autoComplete="new-password" required minLength={SENHA_MINIMA} value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Campo rotulo={t.auth.confirmarSenha} type="password" autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        <Button type="submit" disabled={enviando}>
          {enviando ? t.auth.salvando : t.auth.salvar}
        </Button>
      </form>
    </AuthLayout>
  );
}
