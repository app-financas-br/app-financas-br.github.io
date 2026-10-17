// Ícones do PWA gerados a partir de public/icone.svg (npx @vite-pwa/assets-generator@1.0.0).
// Fundo escuro do tema e sem margem: o desenho já fica dentro da área segura do ícone maskable.
const fundo = { padding: 0, resizeOptions: { background: "#020c16", fit: "contain" } };
export default {
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, "favicon.ico"]], ...fundo },
    maskable: { sizes: [512], ...fundo },
    apple: { sizes: [180], ...fundo },
  },
  images: ["public/icone.svg"],
};
