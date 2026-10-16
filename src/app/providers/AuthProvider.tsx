import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type AuthContexto = {
  session: Session | null;
  carregando: boolean;
  /** true depois que a pessoa abre o link de "esqueci a senha" (evento PASSWORD_RECOVERY). */
  recuperandoSenha: boolean;
  concluirRecuperacao: () => void;
};

const Contexto = createContext<AuthContexto | null>(null);

/** Tira o ?code=... da barra de endereço depois que o Supabase já trocou o código pela sessão. */
function limparCodigoDaUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("code") && !url.searchParams.has("error")) return;
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);

  useEffect(() => {
    let ativo = true;

    // Não chamar métodos do supabase dentro deste callback (pode travar); só atualizar estado.
    const { data } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      if (!ativo) return;
      setSession(novaSessao);
      if (evento === "PASSWORD_RECOVERY") setRecuperandoSenha(true);
      if (evento === "SIGNED_OUT") setRecuperandoSenha(false);
    });

    supabase.auth.getSession().then(({ data: { session: atual } }) => {
      if (!ativo) return;
      setSession(atual);
      setCarregando(false);
      limparCodigoDaUrl();
    });

    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <Contexto.Provider
      value={{ session, carregando, recuperandoSenha, concluirRecuperacao: () => setRecuperandoSenha(false) }}
    >
      {children}
    </Contexto.Provider>
  );
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
