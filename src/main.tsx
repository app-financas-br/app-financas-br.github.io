import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./app/providers/AuthProvider";
import { PeriodoProvider } from "./app/providers/PeriodoProvider";
import { App } from "./app/App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Elemento #root não encontrado");

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PeriodoProvider>
          <App />
        </PeriodoProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
