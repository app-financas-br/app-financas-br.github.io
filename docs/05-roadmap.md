# 05 — Roadmap e critérios de aceite

## Fase 0 — Fundação

- Projeto Vite + React + TS, Tailwind ligado aos tokens, HashRouter, cliente Supabase, react-query.
- `vite.config.ts` com `base: '/financas-app/'`.
- Layout: Sidebar (desktop), BottomNav (celular), Topbar com seletor de mês/ano.
- Login, cadastro, esqueci a senha (`resetPasswordForEmail` + tela de nova senha no evento `PASSWORD_RECOVERY`), sair.
- Deploy funcionando no GitHub Pages.

Aceite: criar conta, entrar, sair e recuperar senha no endereço publicado; o usuário novo já tem categorias padrão no banco.

## Fase 1 — Planilha mensal + Dashboard

- Telas de Entradas, Contas fixas e Gastos variáveis com edição inline, totais (total / pago / pendente), busca, exclusão com desfazer.
- Parcelamento (2–12x), replicar mês, repetir até dezembro.
- Auto-categorização + troca manual com regra + tela de categorias.
- Dashboard: 4 KPIs com sparkline, Disponível (rosca), Evolução do mês, Gastos por categoria, Saúde do mês, Contas a vencer, Últimos lançamentos.
- Virada do mês, preferência "contar só o que foi pago".
- Testes Vitest de `calculos.ts`, `datas.ts`, `dinheiro.ts`, `categorizar.ts`.

Aceite:

- [ ] Um gasto de R$ 100,00 em 3x gera 33,33 + 33,33 + 33,34 em três meses seguidos; em novembro, a 3ª parcela cai em janeiro do ano seguinte.
- [ ] Vencimento dia 31 em 3x a partir de janeiro gera 31/01, 28/02 (ou 29 em ano bissexto) e 31/03.
- [ ] Gasto lançado às 23h30 em São Paulo fica com a data de hoje, não de amanhã.
- [ ] "Disponível" do front bate com `resumo_mes(ano, mes)` do banco.
- [ ] Entrada "A receber" não altera o Disponível; marcar como Recebido altera.
- [ ] Usuário A não vê nenhum dado do usuário B (testar com duas contas).
- [ ] Layout sem rolagem horizontal em 375 px.

## Fase 2 — Voz, investimentos e metas

- Edge Function `voz` publicada; barra de voz, card "Lançar por voz" e painel de confirmação.
- Investimentos: aportes, resgate (modal com origem e destino), categorias, patrimônio e gráfico.
- Metas: CRUD, %, quanto guardar por mês até o prazo, concluir.

Aceite:

- [ ] Falar "gastei 52 e 90 no mercado no débito e 30 de uber" gera 2 itens corretos para confirmar.
- [ ] Falar "recebi 3 mil de salário" gera uma entrada.
- [ ] Sem login a função responde 401; acima do limite diário, 429 com mensagem amigável.
- [ ] Cancelar a gravação libera o microfone (ícone de gravação do navegador some).
- [ ] Funciona no Chrome (Android/desktop) e no Safari (iPhone).

## Fase 3 — Tarefas, exportação e PWA

- Tarefas: linha do tempo por dia, mapa mensal, atrasadas com "Mover para hoje", gestos, notas, timer persistente, voz no modo `tarefas`.
- Exportar: Excel do mês, Excel do ano (aba Resumo + uma aba por tabela, agrupado por ano e mês), backup JSON.
- PWA instalável com service worker (cache do app; leitura offline do último mês carregado).
- Idiomas en/es (opcional).

Aceite:

- [ ] App instala no celular e abre sem a barra do navegador.
- [ ] Excel do ano tem uma linha por lançamento com colunas Ano e Mês corretas.
- [ ] Timer de foco continua contando após recarregar a página.
