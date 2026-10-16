# 01 — Produto e regras de negócio

App web (PWA) de finanças pessoais organizado como uma **planilha mensal**, com lançamento por voz e um módulo de tarefas. Uso individual: cada usuário vê só os próprios dados.

## Módulos

| Módulo | O que faz | Prioridade |
| --- | --- | --- |
| Autenticação | Cadastro e login por e-mail/senha, esqueci a senha, sair | Fase 1 |
| Dashboard | KPIs, evolução, rosca de categorias, saúde do mês, contas a vencer, últimos lançamentos | Fase 1 |
| Entradas | Descrição, valor, data, status Recebido/A receber, % do total | Fase 1 |
| Contas fixas | Descrição, categoria, valor, vencimento, pago, parcelas | Fase 1 |
| Gastos variáveis | Descrição, categoria, valor, data, pago, forma de pagamento, cartão, parcelas, observação | Fase 1 |
| Investimentos | Aportes e resgates por categoria; patrimônio | Fase 2 |
| Metas | Nome, valor alvo, reservado, prazo, % e quanto guardar por mês | Fase 2 |
| Voz | Gravar até 30 s → confirmar itens → lançar | Fase 2 |
| Tarefas | Agenda por dia, prioridade, notas, timer de foco, voz | Fase 3 |
| Exportação | Excel do mês, Excel do ano, backup JSON | Fase 3 |
| PWA | Instalável, ícone, funciona offline para leitura | Fase 3 |

## Navegação por período

- Seletor de **mês e ano** no topo (sem limite fixo de anos). Padrão: mês atual.
- Todas as consultas filtram por `ano` **e** `mes` (números). Nunca agrupar só pelo nome do mês.

## Regras de cálculo

**Disponível para gastar** (mês selecionado):

```
Disponível = Entradas recebidas − Contas fixas − Gastos variáveis − Investimentos do mês
```

- Entradas com `recebido = false` ("A receber") não contam.
- Preferência **Contar só o que foi pago** (`so_pago`, desligada por padrão): ligada, contas fixas e gastos só descontam quando `pago = true`.
- Investimento positivo (aporte) desconta; resgate (valor negativo) devolve.
- Metas não entram em nenhum cálculo.
- A mesma regra existe no banco em `resumo_mes(ano, mes)`; o front pode calcular localmente, mas os dois precisam bater.

**Patrimônio** = `preferencias.saldo_inicial` + soma de todos os `investimentos.valor` do usuário (todos os anos). Editar o total do patrimônio ajusta `saldo_inicial` pela diferença, sem alterar lançamentos.

**Saúde do mês** (gauge 0–100) = (contas fixas + gastos) ÷ entradas recebidas × 100, limitado a 100. Sem entradas: mostra "—".

**Comparativo**: saídas (fixas + gastos) do mês contra o mês anterior, atravessando o ano (janeiro compara com dezembro do ano anterior).

## Parcelamento

Ao escolher N parcelas (2 a 12) num gasto ou conta fixa:

1. Gerar um `grupo_parcela` (uuid).
2. Dividir em centavos exatos: cada parcela recebe `floor(total_centavos / N)`; a última fica com a sobra.
3. O item atual vira a parcela 1 (`parcela_num = 1`, `parcela_total = N`); inserir as parcelas 2..N nos meses seguintes, virando o ano quando preciso.
4. Data/vencimento mantém o dia, limitado ao último dia do mês (31 → 30, 29/02 em ano bissexto).
5. Tudo numa operação: se o insert falhar, desfazer a parcela 1 (ou usar uma função RPC transacional).
6. Exibir "2/10" na linha. Uma parcela não pode ser reparcelada. Excluir uma parcela pergunta: "só esta" ou "esta e as próximas".

## Replicar

- **Replicar mês**: copia entradas ou contas fixas para o mês seguinte (contas com `pago = false`), ignorando parcelas, e navega para lá.
- **Repetir até dezembro**: em uma conta fixa, cria cópias nos meses restantes do ano.

## Virada do mês

Na primeira abertura de um mês novo (mês real, não ao navegar), calcular o saldo do mês anterior com a fórmula do Disponível e perguntar se quer levar:

- Positivo → entrada "Saldo de <mês anterior>" com `origem = 'saldo_anterior'`.
- Negativo → gasto variável "Saldo de <mês anterior>" com o valor absoluto.
- Perguntar uma vez por mês por usuário. Não duplicar se já existir item com `origem = 'saldo_anterior'` no mês.

## Categorias

- Categorias padrão (criadas no cadastro pelo banco): Alimentação, Casa, Saúde, Lazer, Transporte, Outros; investimentos: Renda fixa, Ações e FIIs, Cripto, Reserva.
- Auto-categorização ao digitar a descrição: normalizar (minúsculas, sem acento, só letras/números) e procurar as `palavras` de cada categoria como **palavra inteira**. Sem casamento → Outros.
- Prioridade: `categoria_id` gravado na linha → `categoria_regras` (escolha manual anterior para o mesmo nome) → palavras-chave → Outros.
- Quando o usuário troca a categoria de um lançamento, gravar `categoria_id` e criar/atualizar a regra para aquele nome.
- O usuário cria, renomeia, recolore, oculta e restaura categorias numa tela própria.

## Avisos

- **Contas a vencer**: contas fixas não pagas com vencimento atrasado ou nos próximos 7 dias. Faixa no topo + sino com contador. Dispensar some até a lista ou o dia mudar.
- **Alertas** (cards discretos no dashboard): saldo negativo; ≥ 90% das entradas comprometidas; gastos 30% acima do mês anterior; mês sem investimento com saldo positivo.

## Exclusão e edição

- Excluir some na hora e mostra toast "Desfazer" por 5 s; só então apaga no banco.
- Edição otimista: atualiza a tela, grava no banco, reverte e avisa se falhar.

## Tarefas (fase 3)

- Tarefa: título, nota (até 4000 caracteres), tipo, prioridade, data, concluída, tempo de foco.
- Linha do tempo com uma coluna por dia; mapa mensal com intensidade pela quantidade de tarefas.
- Tarefas atrasadas aparecem num card próprio com botão "Mover para hoje" (não mover automaticamente).
- Gestos no celular: deslizar à esquerda conclui, à direita adia 1 dia, segurar abre o menu.
- Timer de foco grava `timer_inicio` no banco para sobreviver a recarregar.

## Fora do escopo

Painel de leads, questionário de perfil comercial, venda por Pix e qualquer coleta de dados para marketing. Se no futuro houver cobrança, usar webhook do provedor de pagamento, nunca liberar acesso só com o id da transação.

## Correções em relação ao app analisado

| Problema no original | Como fazer aqui |
| --- | --- |
| Datas em UTC (`toISOString`) gravavam o dia seguinte após as 21h | Gerar `AAAA-MM-DD` com o fuso local (`date-fns` ou `Intl` com `America/Sao_Paulo`) |
| `new Date('AAAA-MM-DD')` lido como UTC | Fazer parse manual da string ou usar `parseISO` + funções locais |
| Mês gravado como nome em português | `mes` numérico 1–12 |
| Leitura de linhas `user_id is null` | Nunca; RLS por `auth.uid() = user_id` |
| HTML montado com texto do usuário sem escapar | React escapa por padrão; proibido `dangerouslySetInnerHTML` com dado do usuário |
| Exportação "todos os meses" misturava anos | Agrupar por `ano` + `mes` |
| Excel sempre em R$ | Formato numérico conforme a moeda escolhida |
| Ano travado em 2024–2027 | Sem limite fixo |
| Voz sem autenticação | Edge Function exige login e tem limite diário |
| Bibliotecas sem versão (`@latest`) | Dependências fixadas no `package.json` |
