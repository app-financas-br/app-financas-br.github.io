# 04 — Setup e acessos

Você não precisa me passar nenhuma senha. O Claude Code roda no seu computador e usa os logins que **você** fizer nas ferramentas (GitHub CLI e Supabase CLI). Segredos ficam em arquivos ignorados pelo Git ou nos painéis de segredos — nunca colados em conversa.

## O que criar (uma vez)

| # | Serviço | O que fazer | O que você guarda |
| --- | --- | --- | --- |
| 1 | GitHub | Criar conta (se não tiver), a organização `app-financas-br` e nela o repositório `app-financas-br.github.io` | Nome do repositório |
| 2 | Supabase | Criar projeto. Região: South America (São Paulo). Anote a senha do banco num gerenciador de senhas | Project URL, Project ref, chave publishable (ou anon) |
| 3 | Groq | Criar conta em console.groq.com e gerar uma API key | A chave (segredo) |
| 4 | Seu computador | Instalar Node.js LTS, Git, GitHub CLI (`gh`), Supabase CLI e Claude Code | — |

Sobre o GitHub Pages: na conta gratuita ele publica a partir de repositórios **públicos**. O código ficar público não expõe dados, porque a chave publishable do Supabase é feita para estar no navegador e a segurança vem do RLS. Se preferir repositório privado, é preciso GitHub Pro (ou publicar o mesmo `dist/` em outro host estático).

## Onde cada informação vai

| Informação | É segredo? | Onde colocar |
| --- | --- | --- |
| Project URL do Supabase | Não | `.env.local` (`VITE_SUPABASE_URL`) e segredo do repositório no GitHub |
| Chave publishable/anon | Não (pública por design) | `.env.local` (`VITE_SUPABASE_PUBLISHABLE_KEY`) e segredo do repositório |
| Chave secret / service_role | **Sim** | Não usar no app. Nunca no front-end |
| Senha do banco | **Sim** | Só no gerenciador de senhas; o CLI pede quando precisar |
| Groq API key | **Sim** | `supabase secrets set GROQ_API_KEY=...` (fica no Supabase) |
| Supabase access token (CLI) | **Sim** | Só se for publicar funções pelo GitHub Actions: segredo `SUPABASE_ACCESS_TOKEN` do repositório |

## Passo a passo no seu computador

```bash
# 1. Logins (abrem o navegador; você confirma lá)
gh auth login
supabase login

# 2. Clonar o repositório vazio e copiar este kit para dentro
gh repo clone app-financas-br/app-financas-br.github.io
cd app-financas-br.github.io
# (copie todo o conteúdo deste kit para cá)

# 3. Ligar a pasta ao seu projeto Supabase
supabase init            # cria supabase/config.toml (mantém as pastas migrations/ e functions/ do kit)
supabase link --project-ref <PROJECT_REF>

# 4. Criar as tabelas, RLS e funções no banco
supabase db push

# 5. Segredo da voz e deploy da função
supabase secrets set GROQ_API_KEY=<sua_chave_groq>
supabase secrets set VOZ_LIMITE_DIA=200   # máx. de gravações por dia (uso pessoal: sobra)
supabase functions deploy voz --no-verify-jwt   # a própria função valida o login

# 6. Variáveis do front-end
cp .env.example .env.local   # e preencha URL + chave publishable
```

Depois disso, abra o Claude Code na pasta e cole o conteúdo de `PROMPT-INICIAL.md`.

## Ajustes no painel do Supabase

- **Uso só seu**: depois de criar a sua conta no app, desligue novos cadastros em **Authentication → Sign In / Providers → Allow new users to sign up**. Assim ninguém mais consegue criar conta no seu app.

- **Authentication → URL Configuration**: Site URL = `https://app-financas-br.github.io/`; em Redirect URLs, adicione `https://app-financas-br.github.io/**` e `http://localhost:5173/**`.
- **Authentication → Providers → Email**: deixe ativo. Para testes, pode desligar "Confirm email"; religue antes de outras pessoas usarem.
- **Authentication → Emails**: o envio padrão do Supabase tem limite baixo por hora. Para uso real, configure um SMTP próprio (Resend, Brevo, etc.).
- **Edge Functions → voz → Secrets**: confira se `GROQ_API_KEY` aparece.

## Publicação no GitHub Pages

1. No repositório: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: criar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. O workflow `.github/workflows/deploy.yml` publica a cada push na `main`.
4. Endereço final: `https://app-financas-br.github.io/` (repositório `app-financas-br.github.io` = site na raiz, `base: '/'`). Se publicar em outro repositório, o site vai para uma subpasta: ajuste `base` no `vite.config.ts` e as URLs do Supabase.

## Custos esperados (uso pessoal)

- GitHub Pages e GitHub Actions: grátis para repositório público.
- Supabase: o plano gratuito comporta uso pessoal; projetos gratuitos pausam após um período sem atividade.
- Groq: **plano gratuito**. Limites por dia informados na documentação: cerca de 2.000 transcrições e 8 horas de áudio, e 1.000 interpretações. Uso pessoal de até 30 min de áudio por dia fica abaixo de 10% disso. Ao criar a conta, confira em Settings → Limits se esses números valem para o seu plano. Se um dia passar a pagar: cerca de US$ 0,0003 por gravação de 30 s.
- Total esperado para uso pessoal: **R$ 0**.
