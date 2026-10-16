# Kit do projeto — app de finanças pessoais

Este kit tem tudo o que o Claude Code precisa para construir o app: especificação, design, banco de dados pronto, a função de voz pronta e o deploy no GitHub Pages.

## Checklist rápido

- [ ] Conta no GitHub, no Supabase (região São Paulo) e na Groq (plano gratuito)
- [ ] Chave da Groq gerada (guarde num lugar seguro; ela só vai para o Supabase)
- [ ] Node.js LTS, Git, GitHub CLI (`gh`), Supabase CLI e Claude Code instalados
- [ ] Repositório `financas-app` criado e este kit copiado para dentro
- [ ] Comandos de `docs/04-setup-e-acessos.md` rodados
- [ ] `PROMPT-INICIAL.md` colado no Claude Code
- [ ] Depois de criar sua conta no app: desligar novos cadastros no Supabase

Custo esperado para uso pessoal: R$ 0.

## Ordem para você seguir

1. **Crie as contas** (GitHub, Supabase, Groq) e instale as ferramentas → `docs/04-setup-e-acessos.md`, seção "O que criar".
2. **Crie o repositório** no GitHub e copie todo este kit para dentro dele.
3. **Rode os comandos** da seção "Passo a passo no seu computador" (logins, `supabase db push`, segredo da Groq, deploy da função de voz, `.env.local`).
4. **Abra o Claude Code** na pasta e cole o texto de `PROMPT-INICIAL.md`.
5. Siga fase por fase (`docs/05-roadmap.md`), conferindo os critérios de aceite.

Você não precisa passar nenhuma senha ou chave para ninguém: os logins ficam no seu computador e os segredos ficam no Supabase.

## Conteúdo

| Arquivo | Para quê |
| --- | --- |
| `CLAUDE.md` | Instruções permanentes para o Claude Code (stack, estrutura, regras) |
| `PROMPT-INICIAL.md` | Primeira mensagem para colar no Claude Code |
| `docs/01-produto.md` | Funcionalidades, regras de cálculo, parcelamento, categorias, correções do app analisado |
| `docs/02-design.md` | Linguagem visual e mapa de cada bloco da imagem para o app de finanças |
| `docs/03-voz.md` | Como funciona a voz, contrato da função, comportamento no navegador |
| `docs/04-setup-e-acessos.md` | Contas, segredos, comandos, publicação, custos |
| `docs/05-roadmap.md` | Fases 0 a 3 com critérios de aceite |
| `supabase/migrations/…_schema_inicial.sql` | Tabelas, índices, RLS, categorias padrão e `resumo_mes` |
| `supabase/functions/voz/index.ts` | Edge Function da voz (Groq Whisper + interpretação em JSON) |
| `src/styles/tokens.css` | Cores, tipografia e espaçamentos tirados da imagem |
| `.github/workflows/deploy.yml` | Publicação automática no GitHub Pages |
| `.env.example`, `.gitignore` | Variáveis do front-end e arquivos que não vão para o Git |
| `referencias/design-referencia.jpg` | A imagem de referência visual |

## Decisões já tomadas (pode mudar)

- Nome do repositório: `financas-app` (se mudar, ajuste `base` no Vite e as URLs do Supabase).
- Front-end estático no GitHub Pages; banco, login e voz no Supabase; IA da voz na Groq.
- Ficaram de fora: painel de leads, questionário comercial e venda por Pix do app original.
- A imagem do Pinterest serve só de inspiração de estilo; o app usa nome, logo e ícones próprios.
