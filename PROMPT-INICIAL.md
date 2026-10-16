# Prompt para colar no Claude Code

Abra o terminal na pasta do projeto, rode `claude` e cole o texto abaixo.

---

Vamos construir um app de finanças pessoais do zero nesta pasta.

Antes de escrever código, leia `CLAUDE.md` e todos os arquivos em `docs/`, a migration em `supabase/migrations/`, a função em `supabase/functions/voz/` e olhe a imagem `referencias/design-referencia.jpg`.

Depois:

1. Me diga em poucas linhas o que entendeu do produto, da stack e do design, e liste qualquer dúvida que impeça começar.
2. Confirme que o banco já foi criado rodando `supabase db push --dry-run` (se acusar pendência, me avise antes de aplicar).
3. Execute a **Fase 0** do `docs/05-roadmap.md`: crie o projeto Vite + React + TypeScript, ligue o Tailwind aos tokens de `src/styles/tokens.css`, monte o layout (Sidebar, Topbar com seletor de mês/ano, BottomNav no celular) e as telas de login, cadastro e recuperação de senha.
4. Rode `npm run build` e me mostre o resultado. Não faça commit nem push sem eu pedir.

Regras: siga as "Regras inegociáveis" do `CLAUDE.md`, fixe as versões das dependências e me pergunte antes de criar qualquer tabela ou coluna nova.
