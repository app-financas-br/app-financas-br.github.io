# Estado final do projeto

Fechado em 17/10/2026. App publicado em https://app-financas-br.github.io/ (GitHub Pages, deploy automático a cada push na `main`). Projeto Supabase: `gapfljbyftbusatwrsdz`.

Último fechamento: `npm run test` com 186 testes passando (24 arquivos) e `npm run build` ok (rodados um de cada vez). Todas as 10 migrations de `supabase/migrations/` estão aplicadas no remoto (`npx supabase migration list` mostra local = remoto até `20261017010000`).

Legenda: **verificado** = conferido no navegador (375 px) e/ou no banco com dados falsos "TESTE-", contados antes e depois e apagados no fim; **só testes** = coberto por testes automáticos, sem conferência manual.

## O que está pronto

| Área | Commit | Situação |
| --- | --- | --- |
| Fundação: login, cadastro, recuperar senha, categorias padrão (Fase 0) | `008ecce`, `4e1b807` | Entregue na Fase 0 |
| Planilha mensal (entradas, contas fixas, gastos), Dashboard, parcelas (Fase 1) | `e54befa` | Entregue na Fase 1 |
| Nome único de categoria | `0a2a2ae` | Entregue |
| Planejamento por grupos (renda prevista, % por grupo) — `docs/06-planejamento.md` | `cd0766d` | Verificado |
| Contas bancárias e importação OFX (Nubank, Inter) — `docs/07-importacao.md` | `ec4cf5f` | Verificado com arquivos de exemplo |
| Importação de planilha (modelo .xlsx/.csv), transferências com data de saída | `ce0c8ac` | Verificado com arquivos de exemplo |
| CSV do Nubank e do Inter (conta e cartão) | `d834c05`, `88e0e5b` | Verificado com arquivos de exemplo |
| Cartão de crédito: gasto conta no mês da fatura, fatura atual/próxima — `docs/08-cartao.md` | `b5b53a6` | Verificado |
| Investimentos (aporte/resgate, patrimônio, gráfico do ano) e Metas | `029fc5d` | Verificado |
| Lançamento por voz (gravação, painel de confirmação, gravação no banco) — `docs/03-voz.md` | `f4b5f9d` | Verificado com microfone e IA simulados; ver pendências |
| Escolha "Paga este mês / mês que vem / Fatura de" no crédito; parcelar com mês da 1ª parcela, data real da compra e cartão em todas as parcelas | `9b2453c` | Verificado: 3x gravado 8333 + 8333 + 8334 centavos nos meses certos, parcelas 2+ na fatura do cartão (R$ 166,66 / R$ 166,67), Planejamento e categorias por mês da fatura |
| PWA instalável com leitura offline (Fase 3) | `bfb88c8` | Verificado no desktop: manifesto `standalone`, ícones 200, service worker ativo no site, app abre sem servidor, leitura do Supabase cai para o cache quando a rede falha |
| Exportação para Excel do mês e do ano (Fase 3) | `47477ab` | Verificado: uma linha por lançamento com Ano e Mês corretos, outro ano fica de fora, Disponível do Resumo igual ao do Dashboard, `exceljs` só baixado ao exportar |
| Backup JSON: "Baixar backup" e "Restaurar backup" em Configurações | commit do fechamento | Verificado: backup real salvo fora do projeto e conferido (SHA-256 e contagem de 42 linhas em 15 tabelas), 7 registros "TESTE-" criados em 7 tabelas, restauração pelo app (RPC `restaurar_backup`, uma transação) e comparação campo a campo: 42/42 linhas idênticas, 0 "TESTE-" |
| "Olhinho" no Topbar: oculta valores em dinheiro ("R$ ••••") em todas as telas, gráficos, tooltips e aria-labels; lembra a escolha no aparelho; digitação, Excel e backup não mudam. Tudo passa por `formatarMoeda`/`formatarMovimento`/`formatarCompacto` (`src/lib/dinheiro.ts` + `src/lib/privacidade.ts`) | commit do olhinho | Verificado a 375 px: 0 "R$ <número>" com o olhinho fechado em Dashboard (incl. tooltip), Lançamentos (3 abas), Planejamento, Investimentos, Metas, Configurações e novembro (fatura do cartão); escolha mantida após recarregar; Excel e backup com números reais |
| Carregamento sob demanda (telas, gráficos, painel de voz) | `6902aa4` | Verificado: JS inicial de 1.138 kB (325 kB gzip) para 548 kB (161 kB gzip); telas nunca abertas funcionam offline |

Critérios de aceite do roadmap conferidos nesta etapa final:

- Fase 2: "Cancelar a gravação libera o microfone" — verificado (0 trilhas ativas). "Sem login a função responde 401" — verificado no endereço publicado (`POST /functions/v1/voz` → 401).
- Fase 3: "Excel do ano tem uma linha por lançamento com colunas Ano e Mês corretas" — verificado (teste automático `src/features/exportacao/excel.test.ts` + arquivo gerado no navegador).

## O que foi adiado e como retomar

### 1. Planilha/CSV de bancos com extrato real

Situação: os leitores de Nubank (OFX e CSV) e Inter (OFX e CSV) foram feitos e testados só com arquivos de exemplo montados à mão (`src/features/importacao/__exemplos__/`). O formato do Inter não foi confirmado com arquivo real. O leitor de CSV do **PicPay** não existe: sem um arquivo real, o formato é desconhecido; hoje um CSV do PicPay cai no mapeamento genérico de colunas.

Como retomar:

1. Exportar do banco um extrato real (OFX ou CSV) e guardar **fora do repositório** ou numa pasta ignorada (`extratos/` ou `importar/` estão no `.gitignore`, assim como `*.ofx`, `*.csv`, `*.xlsx`). Nunca fazer commit de extrato real.
2. Abrir **Lançamentos → Importar extrato**, escolher a conta e conferir a pré-visualização (datas, sinais, transferências, categorias).
3. Se algo vier errado, criar um exemplo anonimizado em `src/features/importacao/__exemplos__/` com o mesmo formato, ajustar o leitor em `src/lib/bancos.ts` (ou criar `picpayConta`/`picpayCartao` ali) e adicionar o teste em `src/lib/bancos.test.ts`.
4. Importar com dados reais só depois dos testes passando; usar "Desfazer" se a pré-visualização não bater.

### 2. Publicação da função de voz com CORS restrito

Situação: o código em `supabase/functions/voz/index.ts` (commit `f4b5f9d`) só aceita chamadas do navegador vindas de `https://app-financas-br.github.io`, `http://localhost:5173` e `http://127.0.0.1:5173`. A versão **publicada ainda é a anterior**: em 16/10/2026 um `OPTIONS` com `Origin: https://exemplo-qualquer.com` respondeu `Access-Control-Allow-Origin: *`. A função funciona para o app (o login continua obrigatório: sem login → 401); a nova versão só fecha a função para outros sites. A CLI desta máquina não tinha permissão para publicar funções (403).

Como retomar (uma das duas):

- **Painel do Supabase:** Edge Functions → `voz` → colar o arquivo inteiro de `supabase/functions/voz/index.ts` → publicar com **Verify JWT desligado** (a função confere o login no código).
- **CLI** (com uma conta dona/admin do projeto): definir `SUPABASE_ACCESS_TOKEN` pelo arquivo `$HOME\.app-financas-token` (ver `CLAUDE.md`) e rodar `npx supabase functions deploy voz --no-verify-jwt`. O 403 de antes aconteceu com o login salvo de outra conta; com o token do App Finanças ainda não foi tentado.

Conferir depois:

```bash
curl -s -i -X OPTIONS "$VITE_SUPABASE_URL/functions/v1/voz" -H "Origin: https://exemplo-qualquer.com" -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
# esperado: https://app-financas-br.github.io (e não *)
```

O segredo `GROQ_API_KEY` fica só em `supabase secrets` (nunca no repositório nem no front): `npx supabase secrets set GROQ_API_KEY=...` numa janela separada.

### 3. Testes no celular

Nada foi testado em aparelho real; os testes de layout foram em 375 px no navegador do computador.

Como retomar, no endereço publicado:

| O que testar | Onde | Esperado |
| --- | --- | --- |
| Instalar o app | Chrome Android: menu → "Instalar app"; Safari iPhone: Compartilhar → "Adicionar à Tela de Início" | Ícone da carteira; abre em tela cheia, sem a barra do navegador |
| Leitura offline | Abrir o mês, ligar o modo avião, fechar e abrir o app | Mostra os dados carregados por último e o aviso "Sem internet…"; salvar avisa erro e desfaz |
| Voz real | Chrome Android e Safari iPhone | "gastei 52 e 90 no mercado no débito e 30 de uber" → 2 itens; "recebi 3 mil de salário" → 1 entrada; Cancelar apaga o ícone de microfone |
| Limite diário da voz | Gravar além do limite do dia | Resposta 429 com mensagem amigável |
| Sair da conta | Configurações/menu → Sair, depois modo avião | Os dados offline foram apagados (o cache `supabase-leitura` some ao sair) |

### 4. Tela de Tarefas

Situação: a tabela `tarefas` existe no banco (com RLS, e entra no backup), mas a tela não foi feita; o menu mostra "Em breve". Faltam: linha do tempo por dia, mapa mensal, atrasadas com "Mover para hoje", notas, timer de foco que continua depois de recarregar (colunas `tempo_foco` e `timer_inicio` já existem) e voz no modo `tarefas`.

Como retomar: seguir `docs/05-roadmap.md` (Fase 3, Tarefas) e o critério de aceite "Timer de foco continua contando após recarregar a página". Criar `src/features/tarefas/`, trocar a rota `/tarefas` em `src/app/App.tsx` (hoje `EmBreve`) pela tela nova, com carregamento sob demanda como as outras.

### 5. Idiomas (en/es)

Situação: só pt-BR. Os textos já estão centralizados em `src/i18n/pt-BR.ts` e a tabela `preferencias` aceita `idioma` em `pt-BR`, `en-US` e `es-ES`, mas não há troca de idioma na tela.

Como retomar: criar `src/i18n/en-US.ts` e `src/i18n/es-ES.ts` com o mesmo formato (o tipo de `pt-BR.ts` garante que nenhuma chave falte), escolher o dicionário por `preferencias.idioma` e pôr o seletor em Configurações. Formatos de data e moeda já usam `Intl`.

### 6. Avisos do npm audit

Situação: `npm audit` mostra 2 avisos de gravidade moderada, os dois no `uuid` (< 11.1.1) usado pelo `exceljs` 4.4.0. O `exceljs` só é carregado ao importar ou exportar planilha (não entra no carregamento do app nem no pré-cache do PWA). `npm audit fix --force` trocaria o `exceljs` por uma versão incompatível, então não foi usado.

Como retomar: `npm view exceljs version`; quando sair versão que dependa de `uuid` >= 11.1.1, fixar a versão exata no `package.json`, rodar `npm run test` (inclui `src/features/exportacao/excel.test.ts`) e testar importar e exportar planilha.

### 7. Outros itens menores

- **Isolamento entre usuários com duas contas** (aceite da Fase 1): as políticas RLS estão em todas as tabelas, mas não há registro deste teste no fechamento. Criar uma segunda conta de teste e confirmar que ela não vê nenhum dado da primeira.
- **Voz:** as gravações de vários itens são feitas uma a uma (não numa transação única); se uma falhar, as anteriores ficam gravadas e o painel avisa quantas entraram. A animação do "Disponível" depois de confirmar a voz não foi feita.
- **Restaurar backup em outra conta:** funciona trocando o dono das linhas, mas falha (sem alterar nada) se a conta de origem ainda tiver os mesmos registros, porque os ids se repetem.

## Como trabalhar no projeto

```bash
npm install
npm run dev        # http://localhost:5173 (sem service worker no modo dev)
npm run test       # vitest
npm run build      # gera dist/ com o service worker
# Antes de qualquer comando do Supabase (ver CLAUDE.md): token da conta do App Finanças, sem mostrar o valor
export SUPABASE_ACCESS_TOKEN="$(tr -d '\r\n' < "$HOME/.app-financas-token")"
npx supabase projects list           # gapfljbyftbusatwrsdz precisa aparecer
npx supabase migration list          # antes e depois de aplicar
npx supabase db push --yes           # aplica migrations novas (só depois de aprovadas)
```

- Regras do projeto: `CLAUDE.md`. Banco só muda por migration nova; RLS em toda tabela; datas pelos helpers de `src/lib/datas.ts`; dinheiro em centavos.
- Para testar o PWA localmente: `npm run build` e `npx vite preview --port 5173 --strictPort` (mesma origem do dev, para usar a sessão já logada). Depois, remover o service worker e os caches de `localhost:5173` (DevTools → Application → Storage → Clear site data) antes de voltar ao `npm run dev`.
- Dados de teste: usar o prefixo "TESTE-" na descrição, contar antes e depois e apagar só o que tem o prefixo.
- Backup: Configurações → "Baixar backup" gera `financas-backup-AAAA-MM-DD.json` com todas as tabelas (menos o contador da voz). "Restaurar backup" mostra "Hoje × No arquivo" e pede confirmação; a troca é feita numa transação (`restaurar_backup`). Arquivos `financas-backup-*.json` e a pasta `backups-financas/` estão no `.gitignore`: nunca fazer commit de backup. O backup real usado no teste ficou em `C:\Users\DELL\OneDrive\Documentos\backups-financas\` (fora do projeto).
