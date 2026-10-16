# 06 — Planejamento (orçamento por grupos)

Nova tela **Planejamento** no menu, entre Dashboard e Lançamentos (rota `/planejamento`). Migration: `supabase/migrations/20261016180000_planejamento.sql`.

## Conceitos

- **Grupo**: um balde do orçamento (ex.: Despesas essenciais). Os grupos são do usuário, não do mês. Ele pode criar, renomear e excluir grupos.
- **Plano do mês**: renda prevista + % de cada grupo, guardado por `(ano, mes)`.
- **Ligação categoria → grupo**: `categorias.grupo_id`. Cada categoria pertence a no máximo um grupo. Uma categoria sem grupo aparece numa linha "Sem grupo", só com o realizado.

## Grupos e ligações padrão

| Grupo | % | Categorias |
|---|---|---|
| Despesas essenciais | 50 | Alimentação, Casa (moradia, aluguel e contas de água, luz e internet), Saúde, Transporte, **Impostos** (nova) |
| Lazer | 10 | Lazer (já cobre vestuário e assinaturas pelas palavras-chave) |
| Educação | 10 | **Educação** (nova) |
| Liberdade financeira | 20 | Investimentos: Renda fixa, Ações e FIIs, Cripto |
| Reserva de emergência | 10 | Investimento: Reserva |

- "Outros" fica sem grupo.
- A migration semeia os grupos para todos os usuários (atuais e novos). Ela cria as categorias Educação e Impostos, a menos que já exista uma com o mesmo nome, e liga só as categorias que ainda não têm grupo, então não sobrescreve escolhas já feitas.
- Em Configurações → Categorias, cada categoria ganha um seletor de grupo.

## Regras

1. **Renda prevista**: um campo editável. No mês sem plano próprio, ela vem do último plano salvo antes dele. Sem nenhum plano, vem da soma de todas as entradas do mês (recebidas e a receber).
2. **Mês sem plano** usa o último plano salvo antes dele, pela ordem (ano, mes): renda e %. Grupo sem % nesse plano usa 0. Sem plano nenhum, cada grupo usa o `percentual_padrao` dele.
3. **Editar** a renda ou uma % num mês sem plano próprio cria o plano desse mês (cópia do herdado com a mudança). Salva com a RPC `salvar_planejamento`, de uma vez. A edição é otimista, com rollback.
4. **Previsto** do grupo = renda × % em centavos, pelo método do maior resto. Cada grupo recebe `floor(renda_cent × bp / 10000)`, com bp = % × 100. Os centavos que sobram vão um a um para os maiores restos, com empate pela ordem. Assim, quando as % somam 100, a soma dos previstos é exatamente a renda.
5. **Total das %** fica sempre visível. Quando ele é diferente de 100, aparece um aviso que não bloqueia nada: "Faltam 5%" ou "Passou 5%". **Sobra prevista** = renda − soma dos previstos (pode ser negativa).
6. **Realizado** por grupo no mês: contas fixas + gastos variáveis das categorias do grupo, respeitando a preferência "contar só o que foi pago" (mesma regra do Dashboard). Nos grupos de investimento, conta a soma de `investimentos.valor` do mês (aportes menos resgates, mínimo 0).
7. **Falta** = previsto − realizado. Se o realizado passar do previsto, mostra "Passou R$ X".
8. **Barra de progresso**: realizado ÷ previsto. Normal abaixo de 80%, `--warning` de 80% a 100%, `--danger` acima de 100%. Com previsto 0 e realizado > 0, a barra fica vermelha.
9. **"Aplicar este plano aos próximos meses"**: apaga os planos próprios dos meses depois do selecionado, que passam a herdar este. Antes, confirma no modal: "N meses têm plano próprio e serão substituídos".
10. **Excluir grupo**: aplica "Desfazer" por 5 s. As categorias dele ficam sem grupo e as % dele somem dos planos (cascade).

## Telas

- **Planejamento**: card da renda prevista; tabela de grupos (nome, %, previsto, realizado, falta, barra) com total das % e sobra prevista; rosca "Distribuição da renda" com legenda ao lado no computador e embaixo no celular; botão "Aplicar aos próximos meses". Skeleton, vazio e erro em todo card.
- **Dashboard**: card pequeno "Planejamento do mês" com cada grupo e sua barra, que leva para `/planejamento`.
- **Gastos por categoria** (card que já existe):
  - esconde as categorias com R$ 0;
  - junta as fatias menores que 3% em "Outras";
  - mostra valor e % na legenda e na tabela;
  - tocar numa categoria abre um modal com os lançamentos dela no mês. Tocar em "Outras" lista as categorias agrupadas.

## Código

- `src/lib/planejamento.ts` (funções puras, testadas): `previstoPorGrupo`, `avisoPercentual`, `realizadoPorGrupo`, `planoVigente` (herança) e `nivelBarra`.
- `src/lib/dashboard.ts`: `porCategoria` passa a agrupar < 3% em "Outras" (antes eram 6 fatias + "Demais").
- `src/features/planejamento/`: tela, hooks (react-query) e API.

## Testes

- O previsto em centavos soma exatamente a renda com % = 100 (ex.: R$ 1.000,01 com 33,33/33,33/33,34).
- Aviso "Faltam X%" / "Passou X%" / nenhum aviso com 100%.
- Realizado por grupo pela ligação categoria → grupo, com "só pago" ligado e desligado, e categoria sem grupo indo para "Sem grupo".
- Herança: mês sem plano usa o anterior mais próximo, inclusive virando o ano.
- `porCategoria`: some com R$ 0 e agrupa < 3%.
