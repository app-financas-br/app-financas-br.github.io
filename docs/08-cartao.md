# 08 — Cartão de crédito (o gasto conta no mês em que a fatura vence)

Migration: `supabase/migrations/20261016230000_cartao_credito.sql`.

## Cadastro do cartão

- O cartão é uma conta bancária do tipo **cartão de crédito**. Em Configurações → Contas ele ganha **dia de fechamento**, **dia de vencimento** (1–31), **conta que paga a fatura** e o interruptor **compra no dia do fechamento vai para a próxima fatura** (ligado por padrão). Esses três campos só existem para cartão; o banco recusa nos outros tipos.
- Sem dia de fechamento e vencimento, o cartão continua na regra antiga (mês da compra) e mostra o aviso "Informe o fechamento e o vencimento".

## Regra do mês (`lib/fatura.ts`, função pura)

`faturaDaCompra(dataCompra, diaFechamento, diaVencimento)` → `{ ano, mes, fechamento, vencimento }`, em que ano/mes = mês do **vencimento**.

1. **Fechamento** do mês M = o dia de fechamento, limitado ao último dia do mês (fechamento 31 em fevereiro = 28 ou 29).
2. Compra **antes** do fechamento do mês dela → fatura que fecha nesse mês. Compra **depois** → fatura que fecha no mês seguinte. Compra **no dia** do fechamento: vai para a fatura seguinte quando o interruptor "compra no dia do fechamento vai para a próxima fatura" está ligado (padrão, `compra_no_fechamento_proxima`); desligado, entra na fatura que fecha naquele dia.
3. **Vencimento**: se o dia de vencimento é maior que o de fechamento, vence no mesmo mês do fechamento; senão (ex.: fecha 28, vence 5), no mês seguinte. Também fica limitado ao último dia do mês.
4. Vira o ano normalmente (compra em 20/12 com fechamento no dia 10 → fecha 10/01 → vence em janeiro ou fevereiro).

Exemplos (fecha 3, vence 10, interruptor ligado): compra 02/10 → vence 10/10 (outubro); compra 03/10 → vence 10/11 (novembro). Com o interruptor desligado, a de 03/10 vence em 10/10. Fecha 28, vence 5: compra 16/10 → fecha 28/10 → vence 05/11 (novembro).

## Como o gasto é gravado

- `data` = data da **compra**. `ano`/`mes` = mês da **fatura**. `conta_bancaria_id` = o cartão. `forma_pagamento = 'credito'`.
- A pré-visualização e o lançamento manual mostram "Compra 16/10 → conta em novembro". No lançamento manual, a pessoa escolhe o mês (ver "Escolha do mês da fatura").
- O Dashboard, o Planejamento e o "Disponível" já filtram por ano/mês, então o gasto do cartão passa a contar no mês da fatura sem mudar essas telas. No Planejamento, conta no grupo da categoria dele.

## Importação de cartão

- **Arquivo de uma fatura** (ex.: CSV de fatura do Nubank): um seletor "Este arquivo é a fatura de: [mês]" já vem preenchido com o mês calculado pela compra mais recente. Todos os itens vão para esse mês.
- **Extrato corrido** do cartão (ex.: OFX do cartão): cada item usa a regra do mês.
- **Parcelado**: "Parcela 2/6" na descrição grava `parcela_num = 2` e `parcela_total = 6` no mês da fatura em que aparece. As parcelas seguintes **não** são criadas, porque virão nas próximas faturas importadas. A chave da linha inclui o texto "Parcela 2/6", então cada parcela entra uma vez só.
- **Estornos e créditos** (valor negativo no cartão, exceto o pagamento da fatura) viram gasto com **valor negativo** no mês da fatura em que aparecem, na categoria da compra. Assim abatem o total do mês e do grupo.
- **IOF, anuidade e juros** entram como gasto na categoria nova **Tarifas** (palavras-chave: iof, anuidade, juros, encargos, tarifa…), que fica no grupo Despesas essenciais.

## Pagamento da fatura

- "Pagamento de fatura" na conta corrente e "Pagamento recebido" no cartão são uma **transferência** conta → cartão, e não um gasto. Assim a compra não conta duas vezes.
- Na importação, o app sugere a transferência para o cartão cuja `conta_pagamento_id` é a conta do extrato (ou para o único cartão, se houver um só). Se as duas pontas forem importadas, o par é detectado como nas outras transferências.

## Escolha do mês da fatura (lançamento manual, voz e parcelar)

Não existe padrão fixo "mês seguinte": em todo gasto no crédito, a pessoa escolhe quando paga.

- Dois botões de escolha rápida: **"Paga este mês"** (mês da compra) e **"Paga mês que vem"**, mais o campo **"Fatura de"** para qualquer outro mês. A **data da compra** continua sendo a real. Aparecem no modal de Detalhes (que abre ao trocar o pagamento para Crédito), no painel de voz e no modal de Parcelar.
- **Com cartão cadastrado** (fechamento e vencimento): a sugestão vem da regra acima e já vem marcada (etiqueta "sugerido"). Ex.: fecha 14 e vence 21 → compra até o dia 13 é "este mês" e depois do dia 14 é "mês que vem". A compra feita no próprio dia 14 segue o interruptor do fechamento (ligado = mês que vem). Se o vencimento cair no mês seguinte ao fechamento (ex.: fecha 28, vence 5), a sugestão anda um mês, porque o gasto conta no mês em que a fatura vence. Um toque troca a escolha.
- **Sem cartão cadastrado** (ou sem fechamento e vencimento): começa em "Paga este mês". O app não tenta adivinhar o mês seguinte.
- Trocar o cartão no modal volta para a sugestão daquele cartão.
- **Mudar a data da compra na tabela:** se o gasto estava na sugestão, passa para a nova sugestão. Se a pessoa tinha trocado o mês à mão, o app mantém a mesma distância do mês da compra (ex.: tinha escolhido o mês seguinte, continua o mês seguinte).
- Se o mês escolhido não for o que está aberto na tela, o gasto muda para lá e aparece o toast "Compra 16/10 no Cartão Nubank → conta em novembro de 2026." com o botão "Ver".
- **Parcelado:** a escolha vale para a 1ª parcela e as demais vêm nos meses seguintes. O modal mostra "Compra 16/10 → conta em <mês>" para cada parcela, com os meses reais. A RPC `parcelar_lancamento` recebe `p_ano`/`p_mes` da 1ª parcela (na mesma transação). No crédito, todas as parcelas guardam a data real da compra e o cartão (`conta_bancaria_id`). Migration: `20261017000000_parcelar_credito.sql`.
- **Totais:** o Dashboard, o Planejamento, as categorias, o "Disponível" e as faturas por cartão filtram por `ano`/`mes`, que é o mês escolhido em "Fatura de". A data da compra não entra nessa conta.
- Funções puras em `lib/fatura.ts`: `sugerirFatura`, `faturaDaOpcao`, `opcaoDaFatura`, `faturaAoMudarData`, `faturasDasParcelas`.

## Dashboard

- Por cartão: "Fatura atual (vence dd/mm): R$ X" e "Próxima fatura: R$ Y". A fatura atual é a da compra feita hoje.
- No mês selecionado, conta só o que pertence à fatura que vence nesse mês (já é o efeito de ano/mês = mês da fatura).

## Testes (`lib/fatura.test.ts` e importação)

- Compra no dia do fechamento e um dia depois.
- Fechamento 31 em fevereiro (comum e bissexto), em abril (30 dias) e em março.
- Vencimento antes do fechamento (vence no mês seguinte) e depois (mesmo mês).
- Virada de ano: compra em dezembro que vence em janeiro ou fevereiro.
- Vencimento dia 31 em mês de 30 dias.
- Importação: fatura inteira no mês escolhido; extrato corrido pela regra; "Parcela 2/6"; estorno negativo; IOF em Tarifas; pagamento sugerido como transferência.
