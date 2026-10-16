# CLAUDE.md — instruções para o Claude Code

App de finanças pessoais (planilha mensal + voz + tarefas). Leia nesta ordem antes de codar:

1. `docs/01-produto.md` — módulos, regras de cálculo, parcelamento, categorias
2. `docs/02-design.md` + `src/styles/tokens.css` + `referencias/design-referencia.jpg` — visual
3. `docs/03-voz.md` + `supabase/functions/voz/index.ts` — voz
4. `supabase/migrations/20261016000000_schema_inicial.sql` — banco (fonte da verdade)
5. `docs/05-roadmap.md` — fases e critérios de aceite

## Stack

- Vite + React + TypeScript (strict)
- Tailwind CSS mapeado para as variáveis de `tokens.css` (não usar a paleta padrão do Tailwind para cores)
- `@supabase/supabase-js` v2 + `@tanstack/react-query` para dados
- `react-router` com **HashRouter** (GitHub Pages não tem rewrite de rotas)
- Recharts para gráficos; `lucide-react` para ícones; `date-fns` para datas
- `vite-plugin-pwa` (fase 3); `exceljs` carregado sob demanda (fase 3)
- Vitest para testes das regras de cálculo
- Fixe versões exatas no `package.json` (nada de `latest`)

## Estrutura

```
src/
  app/            rotas, layout (Sidebar, Topbar, BottomNav), providers
  components/ui/  Card, KpiCard, Button, Pill, DataTable, Modal, Toast, Gauge, Donut...
  features/
    dashboard/  entradas/  contas-fixas/  gastos/  investimentos/  metas/
    voz/        tarefas/   categorias/    exportacao/  auth/
  lib/
    supabase.ts      cliente único
    datas.ts         hoje local, parse AAAA-MM-DD, último dia do mês, próximo mês
    dinheiro.ts      centavos, formatar por moeda, parse "1.234,56"
    calculos.ts      resumoMes, saudeMes, patrimonio, dividirParcelas (100% testado)
    categorizar.ts   normalizar texto + casar palavras-chave + regras
  styles/tokens.css
```

## Regras inegociáveis

- **Banco**: só mudar via nova migration em `supabase/migrations/`. RLS em toda tabela. Nunca consultar `user_id is null`. Nunca usar a chave secret/service_role no front.
- **Datas**: nunca `new Date().toISOString().slice(0,10)` para "hoje" e nunca `new Date('AAAA-MM-DD')`. Use os helpers de `lib/datas.ts` (fuso local).
- **Dinheiro**: cálculos em centavos inteiros; `numeric` do banco chega como número ou string — sempre `Number()`.
- **Período**: toda consulta filtra `ano` e `mes` (números). Mês anterior de janeiro = dezembro do ano anterior.
- **Segurança**: sem `dangerouslySetInnerHTML` com dado do usuário. Segredos só em `.env.local` (públicos) ou `supabase secrets` (privados).
- **UX**: edição inline otimista com rollback; exclusão com "Desfazer" 5 s; estados de vazio, carregando (skeleton) e erro em todo card.
- **Visual**: seguir `docs/02-design.md`. Tema escuro é o padrão. Mobile primeiro (testar em 375 px).
- **Idioma**: interface em pt-BR; textos centralizados em `src/i18n/pt-BR.ts` para permitir en/es depois.

## Comandos

```bash
npm run dev          # http://localhost:5173
npm run build        # gera dist/ (base '/', site em https://app-financas-br.github.io/)
npm run test         # vitest
supabase db push     # aplica migrations no projeto linkado
supabase functions deploy voz --no-verify-jwt   # a função valida o login no código
```

## Como trabalhar

- Uma fase por vez (`docs/05-roadmap.md`). Ao fim de cada fase: `npm run build` e `npm run test` passando, e um resumo do que foi feito.
- Antes de criar tabela, coluna ou função nova, proponha a migration e espere confirmação.
- Commits pequenos, em português, no imperativo ("Adiciona tabela de gastos").
