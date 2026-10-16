import { Outlet } from "react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";

export function AppLayout() {
  return (
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
    </div>
  );
}
