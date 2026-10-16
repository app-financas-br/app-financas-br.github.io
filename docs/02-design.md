# 02 — Design

Referência visual: `referencias/design-referencia.jpg` (print de um app de trading, usado só como inspiração de estilo). Copiamos a **linguagem visual**, não a marca: nada de logo, nome "TradeVision", ícones de cripto ou textos de trading.

Tokens prontos em `src/styles/tokens.css`. Nenhum componente usa cor solta.

## Linguagem visual

| Elemento | Como é na referência | Regra para o nosso app |
| --- | --- | --- |
| Fundo | Azul-marinho quase preto (`#020c16`) | `--bg-app`; cards um tom acima (`--bg-card`) |
| Cards | Cantos 12–16 px, borda fina 1 px (`--border`), sem sombra forte | Todo bloco é um card; padding 16–20 px |
| Título de card | CAIXA ALTA, 12 px, peso 600, cinza claro | `.card-title` com `letter-spacing: .04em` |
| Acento | Verde-menta neon com brilho suave | `--primary` só para ação principal, item ativo e dado positivo |
| Números | Grandes, brancos, tabulares | KPIs em 28 px, `tabular-nums` |
| Variação | Verde positivo / vermelho negativo, com sinal | `+6,21%` em `--success`, `-1,08%` em `--danger` |
| Gráficos | Linhas finas com área em degradê que some para baixo, grade quase invisível | Área com `linearGradient` de 35% → 0% de opacidade |
| Abas de período | Pílulas pequenas; a ativa tem fundo verde translúcido | `Mês · 3M · 6M · Ano` |
| Botão secundário | Contorno verde, texto verde, fundo transparente | "Ver detalhes", "Ver todos" |
| Ícones | Traço fino, monocromáticos, dentro de quadrado arredondado colorido translúcido | `lucide-react`, 18–20 px |
| Navegação | Barra lateral com item ativo em pílula verde translúcida com borda | No celular vira barra inferior com 5 itens |

## Mapa da tela principal (Dashboard)

Cada bloco da referência ganha um equivalente financeiro. A grade é de 12 colunas no desktop (≥ 1024 px).

| Bloco da referência | No nosso app | Dados |
| --- | --- | --- |
| Barra lateral (Dashboard, Portfolio, Markets…) | Dashboard, Lançamentos, Investimentos, Metas, Tarefas, Relatórios, Configurações | — |
| Card "AI Signal / Strong Buy" na lateral | **Assistente de voz**: ícone de microfone com brilho, frase "Fale um gasto", botão "Gravar" | Abre a gravação |
| Topo: título + seletor USD + sino + avatar | Título da página, seletor de mês/ano, moeda, sino de contas a vencer, avatar com menu | `preferencias`, contas a vencer |
| 4 KPIs com sparkline (Total Portfolio, 24h P/L, Win Rate, Active Positions) | **Entradas do mês**, **Saídas do mês**, **Investido no mês**, **Disponível para gastar** | Sparkline = acumulado diário; variação % vs mês anterior |
| Portfolio Performance (área grande com abas de período) | **Evolução do saldo**: acumulado de entradas × saídas por dia no mês; nas abas 3M/6M/Ano, por mês | Tooltip com o dia e os lançamentos |
| Asset Allocation (rosca + legenda %) | **Gastos por categoria** (rosca + legenda com valor e %) | Total no centro |
| Market Sentiment (gauge 0–100, "78 Greed") | **Saúde do mês**: % das entradas recebidas já comprometido (0–100). Rótulos: Tranquilo < 70, Atenção 70–89, No limite ≥ 90 | Gauge vermelho→verde invertido: quanto mais comprometido, mais vermelho |
| Top Markets (lista com preço, % e sparkline) | **Contas a vencer e atrasadas** (nome, valor, prazo) ou **Maiores gastos do mês** | Linha clicável leva ao lançamento |
| AI Trading Signals (círculo com brilho + contagem regressiva) | **Lançar por voz**: botão circular grande com anéis animados; durante a gravação mostra `00:12` contando até 30 s e a legenda ao vivo | Função `voz` |
| Trading Chart (candles + volume) | **Patrimônio**: linha do patrimônio (saldo inicial + aportes − resgates) por mês, com barras de aporte embaixo (como o volume) | `investimentos` do ano |
| Performance (barras esta semana × semana passada) | **Gastos por dia da semana**: esta semana × semana passada | `gastos_variaveis` |
| Recent Activity | **Últimos lançamentos** (tipo, descrição, valor colorido) | Todas as tabelas, 5 mais recentes |
| Faixa de recursos no rodapé | Só na tela de login/boas-vindas | — |

Ordem no celular (< 768 px), uma coluna: seletor de mês → barra de voz fixa → 4 KPIs em grade 2×2 → Disponível/rosca → Contas a vencer → Evolução → Gastos por categoria → Últimos lançamentos → demais blocos.

## Telas de lançamento (planilha)

Mesmo visual de card escuro. Tabelas com linhas de 44 px, cabeçalho em CAIXA ALTA 11 px cinza, separador `--border`, hover `--bg-card-hover`.

- Edição inline: clicar na célula vira campo; salva ao sair do campo; indicador "Salvando… / Salvo / Sem conexão" no topo.
- Status como pílula clicável: `Pago` (verde), `Pendente` (laranja), `Atrasada` (vermelho), `A receber` (laranja).
- Forma de pagamento como pílula que alterna ao clicar: Pix → Débito → Crédito → Dinheiro.
- Rodapé de cada tabela com Total, Pago e Pendente.
- Excluir: menu "⋯" da linha e, no celular, arrastar para a esquerda; sempre com "Desfazer" por 5 s.

## Componentes base (criar primeiro)

`Card`, `CardTitle`, `KpiCard` (valor, variação, sparkline), `PeriodTabs`, `Pill`, `Button` (primário, contorno, fantasma), `IconBadge`, `DataTable` com célula editável, `Modal`, `ConfirmDialog`, `Toast` com ação, `EmptyState`, `Skeleton`, `Gauge`, `Donut`, `AreaChart`, `BarChart`, `Sparkline`, `MonthPicker`, `VoiceButton`.

## Movimento

- Transições de 150–250 ms com `cubic-bezier(.22,.61,.36,1)`.
- O valor "Disponível para gastar" anima contando do valor antigo ao novo após cada lançamento.
- Botão de voz: anéis concêntricos pulsando enquanto grava; equalizador reage ao volume real do microfone.
- Respeitar `prefers-reduced-motion`.

## Acessibilidade

- Contraste mínimo AA (texto `--text-muted` só em 12 px ou mais sobre `--bg-card`).
- Cor nunca é o único sinal: variações levam `+`/`-` e seta; status levam texto.
- Todo botão só com ícone tem `aria-label`. Foco visível com `--glow-primary`.
