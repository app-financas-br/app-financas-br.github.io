// Envio do áudio para a Edge Function "voz" (contrato em docs/03-voz.md).
import { supabase } from "../../lib/supabase";
import type { ItemVoz } from "../../lib/voz";
import { t } from "../../i18n/pt-BR";

const TIMEOUT_MS = 25_000;

export type RespostaVoz = { transcricao: string; itens: ItemVoz[] };

/** Envia o áudio com o token do usuário; erros viram mensagens para a pessoa. */
export async function enviarVoz(audio: Blob, categoriasGasto: string[], categoriasInvestimento: string[]): Promise<RespostaVoz> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(t.vozPainel.erros.login);

  const ext = audio.type.includes("mp4") ? "m4a" : "webm";
  const fd = new FormData();
  fd.append("audio", audio, `voz.${ext}`);
  fd.append("modo", "financeiro");
  fd.append("categorias_gasto", JSON.stringify(categoriasGasto));
  fd.append("categorias_investimento", JSON.stringify(categoriasInvestimento));

  const controle = new AbortController();
  const timer = window.setTimeout(() => controle.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voz`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: fd,
      signal: controle.signal,
    });
  } catch (e) {
    throw new Error((e as Error).name === "AbortError" ? t.vozPainel.erros.demorou : t.vozPainel.erros.rede);
  } finally {
    window.clearTimeout(timer);
  }

  const corpo = (await resp.json().catch(() => ({}))) as { erro?: string; transcricao?: string; itens?: ItemVoz[] };
  if (!resp.ok) {
    const porStatus: Record<number, string> = {
      401: t.vozPainel.erros.login,
      404: t.vozPainel.erros.naoPublicada,
      413: t.vozPainel.erros.grande,
      429: t.vozPainel.erros.limite,
      503: t.vozPainel.erros.ocupada,
    };
    throw new Error(porStatus[resp.status] ?? corpo.erro ?? t.vozPainel.erros.generico);
  }
  return { transcricao: corpo.transcricao ?? "", itens: Array.isArray(corpo.itens) ? corpo.itens : [] };
}
