// Leitura offline (PWA): o service worker guarda as respostas de leitura do Supabase neste cache.
import { useSyncExternalStore } from "react";

/** Nome do cache das leituras do Supabase (usado no vite.config.ts e apagado ao sair da conta). */
export const CACHE_LEITURA = "supabase-leitura";

/** Ao sair da conta, apaga os dados guardados para leitura offline (privacidade em aparelho compartilhado). */
export function limparLeituraOffline(): void {
  if (typeof caches === "undefined") return;
  void caches.delete(CACHE_LEITURA).catch(() => {});
}

const assinar = (avisar: () => void) => {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
};

/** true quando o navegador está sem internet. */
export function useOffline(): boolean {
  return useSyncExternalStore(assinar, () => !navigator.onLine, () => false);
}
