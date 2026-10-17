import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { CACHE_LEITURA } from "./src/lib/offline.ts";

// base "/": site de organização no GitHub Pages, na raiz (https://app-financas-br.github.io/)
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    // PWA (docs/05-roadmap.md, Fase 3): instalável, abre sem a barra do navegador e lê offline
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "icone.svg"],
      manifest: {
        name: "Finanças",
        short_name: "Finanças",
        description: "Planilha mensal de finanças pessoais",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#020c16",
        theme_color: "#020c16",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // exceljs (importar/exportar planilha) só é baixado quando usado; não entra na instalação
        globIgnores: ["**/exceljs*.js"],
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Leituras (GET) das tabelas: tenta a rede; sem internet, usa a última resposta guardada.
            // RPCs (POST), login e a função de voz nunca vão para o cache.
            urlPattern: ({ url, request }) =>
              request.method === "GET" && url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/rest/v1/"),
            handler: "NetworkFirst",
            options: {
              cacheName: CACHE_LEITURA,
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fontes", cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
  build: {
    // Só o exceljs passa de 500 kB, e ele é baixado apenas ao importar ou exportar planilha
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Bibliotecas em arquivos com nome fixo: mudam pouco, então o navegador reaproveita entre versões.
        // Recharts fica separado e só é baixado quando um gráfico aparece (components/graficos/sobDemanda.tsx).
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
            {
              name: "recharts",
              test: /node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor|decimal\.js-light|@reduxjs|redux|redux-thunk|immer|reselect|react-redux|es-toolkit|eventemitter3|tiny-invariant)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
