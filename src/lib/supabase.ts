import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !chave) {
  throw new Error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).");
}

// Cliente único do app. Só a chave publishable: a segurança vem do RLS.
// flowType "pkce": os links de e-mail (confirmação, recuperação) voltam com
// ?code=... na query, o que não colide com o # do HashRouter.
export const supabase = createClient(url, chave, {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Endereço do app para onde os e-mails do Supabase redirecionam. */
export function urlDoApp(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
