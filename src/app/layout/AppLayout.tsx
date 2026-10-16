import { Outlet } from "react-router";
import { Mic } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { AssistenteVozProvider, useAssistenteVoz } from "../../features/voz/AssistenteVoz";
import { t } from "../../i18n/pt-BR";

/** Botão flutuante de voz no celular (no desktop, o card da barra lateral faz o mesmo). */
function BotaoVozFlutuante() {
  const { abrir } = useAssistenteVoz();
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={t.voz.flutuante}
      title={t.voz.flutuante}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-app shadow-[var(--glow-primary)] lg:hidden"
    >
      <Mic size={24} aria-hidden />
    </button>
  );
}

export function AppLayout() {
  return (
    <AssistenteVozProvider>
      <div className="flex min-h-dvh bg-app">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* pb extra no celular para o conteúdo não ficar atrás da barra inferior */}
          <main className="flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 lg:pb-6">
            <Outlet />
          </main>
        </div>
        <BottomNav />
        <BotaoVozFlutuante />
      </div>
    </AssistenteVozProvider>
  );
}
