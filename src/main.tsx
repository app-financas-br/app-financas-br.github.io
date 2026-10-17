import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./app/providers/AuthProvider";
import { PeriodoProvider } from "./app/providers/PeriodoProvider";
import { App } from "./app/App";
import { ToastProvider } from "./components/ui/Toast";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    // offlineFirst: sem internet, a consulta ainda vai ao service worker, que devolve a última leitura guardada
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false, networkMode: "offlineFirst" },
    // Gravações sem internet falham na hora (desfaz a edição otimista e avisa) em vez de ficarem presas
    mutations: { networkMode: "always" },
  },
});

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Elemento #root não encontrado");

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PeriodoProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </PeriodoProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
