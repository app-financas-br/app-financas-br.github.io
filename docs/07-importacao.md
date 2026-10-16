# 07 — Importação de extratos e contas bancárias

Migration: `supabase/migrations/20261016200000_importacao.sql`. O cartão de crédito (fatura, fechamento e vencimento) fica para a parte C (`docs/08-cartao.md`).

## Ordem de entrega

| Etapa | O que entra |
|---|---|
| **B1** | Contas bancárias, importação **OFX**, pré-visualização, sem duplicar, transferências, saldo consolidado no Dashboard |
| **B2** | Planilha: modelo do app (xlsx/csv) + planilha qualquer com mapeamento de colunas. É o motor que os CSV dos bancos reutilizam |
| **B3…** | CSV de um banco por vez: **Nubank** (conta e cartão), **Inter** e **PicPay**. Os demais bancos ficam pelo OFX; um CSV novo só quando for pedido |

Cada etapa fecha com build + testes + navegador em 375 px. Para testar com extrato real, eu peço o arquivo exportado do banco.

## Contas bancárias

- Ficam em Configurações → Contas: nome, banco, tipo (corrente, poupança, cartão de crédito), saldo inicial, cor e ativa.
- Uma conta com transferências não pode ser apagada, só desativada. Apagar uma conta sem transferências deixa os lançamentos dela sem conta.
- O OFX traz BANKID e ACCTID. Na primeira importação, o app grava esses dois dados na conta escolhida (`ofx_banco`, `ofx_conta`). Nas próximas, sugere a mesma conta sozinho.

## Lançamentos

- `entradas`, `contas_fixas`, `gastos_variaveis` e `investimentos` ganham `conta_bancaria_id` (opcional) e `origem = 'importado'`.
- Os importados entram como recebidos ou pagos. O mês é o da data, sempre no fuso local, sem `new Date('AAAA-MM-DD')`.
- Tipo sugerido:
  - Crédito: entrada.
  - Débito: gasto (forma débito).
  - Débito com o mesmo valor e nome de uma conta fixa não paga do mês: aviso "parece a conta fixa X" com o botão **Marcar como paga**. Assim a conta fixa fica paga e ligada à conta bancária, sem criar lançamento novo. Se você não usar o botão, a linha é importada normalmente.
  - Descrição com "aplicacao"/"resgate" (CDB, Tesouro, poupança): investimento.

## Leitura (tudo no navegador; o arquivo não é enviado nem guardado)

- **OFX 1.x (SGML) e 2.x (XML)**: tags sem fechamento, `STMTTRN`, `FITID`, `DTPOSTED`, `TRNAMT`, `MEMO`/`NAME`, `BANKID`/`ACCTID`.
  - **Encoding**: o arquivo é lido como bytes. Se o cabeçalho diz `CHARSET:1252`, `ISO-8859-1` ou `encoding="..."`, usa esse; senão tenta UTF-8 e, se der caractere inválido, cai para windows-1252 (que cobre o latin-1 dos bancos brasileiros).
  - `DTPOSTED` `20261016120000[-3:BRT]` → usa só AAAAMMDD, para não deslocar o dia por fuso.
  - `TRNAMT` aceita `-52.90` e `-52,90`.
- **Datas e valores** (B2+): dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd; vírgula decimal, milhar com ponto, sinal negativo, "R$", ou colunas separadas de débito/crédito.
- **Planilha (B2)**: CSV (separador ; , ou tab detectado, aspas, latin-1 ou UTF-8) e .xlsx (exceljs carregado só ao abrir uma planilha). O app acha a linha do cabeçalho e sugere as colunas pelo nome (Data, Histórico/Descrição, Valor ou Débito+Crédito, Tipo, Categoria); dá para trocar cada uma. Linhas sem data ou valor (saldo, total) são listadas como ignoradas. Com a coluna Tipo, o tipo manda no sinal: gasto, conta fixa e aporte saem; entrada e resgate entram; em Transferência vale o sinal da planilha. Categoria escrita na planilha casa pelo nome.
- **Modelo do app** (.xlsx): a aba "Lançamentos" só tem o cabeçalho (é a que o app lê). Os exemplos ficam na aba "Como preencher" e nunca são importados.

## Pré-visualização

- Cada linha mostra data, descrição, valor, conta, tipo e categoria sugerida (mesmas regras de `categorizar.ts`), tudo editável. Tem uma caixa "ignorar" por linha.
- No topo: "N novas · M já importadas (serão puladas) · K transferências sugeridas".
- **Confirmar** grava tudo de uma vez com a RPC `importar_lancamentos` (uma transação). Depois mostra "N lançamentos importados, M pulados".

## Sem duplicar

- A chave é por conta, guardada em `importacoes_chaves`.
  - OFX: `ofx:<FITID>`.
  - Demais formatos: `h:` + SHA-256 de (conta + data + valor em centavos + descrição normalizada) + `#n`. O `n` conta as repetições idênticas dentro do mesmo arquivo, para que dois cafés iguais no mesmo dia não virem um só.
- A pré-visualização já marca as linhas com chave existente como "já importada". O banco também recusa a chave repetida, então dois cliques ou duas abas não duplicam.
- Apagar um lançamento importado não apaga a chave. Reimportar o arquivo não traz de volta o que você apagou.

## Transferências entre minhas contas

- **Par**: mesmo valor, sinais opostos, datas a até 2 dias uma da outra e contas diferentes do usuário. A outra ponta pode estar:
  1. no mesmo arquivo ou lote;
  2. já gravada, importada de outra conta (entrada ou gasto com `origem = 'importado'`);
  3. já registrada como transferência. Nesse caso a linha é marcada "já registrada" e pulada.
- Na pré-visualização, o par aparece como sugestão: "Transferência Nubank → Inter". Você confirma ou recusa linha a linha.
- **Data da transferência** = data da ponta de **saída** (Pix enviado em 10/10 e recebido em 11/10 → transferência em 10/10). No "Desfazer", a linha do extrato volta com a data dela.
- Confirmada, vira uma linha em `transferencias`, fora de entradas e gastos (não mexe no Disponível nem no Planejamento).
- Se a outra ponta já estava gravada como entrada ou gasto, ela é **convertida**: sai de entradas/gastos e vira a transferência com o **mesmo id e os mesmos dados** (as transferências têm tabela própria). A linha original fica guardada em `convertido_de`. A pré-visualização mostra o que vai mudar ("Gasto \"PIX ENVIADO\" de 10/10 no Nubank → vira transferência Nubank → Inter"). Depois de gravar, um toast oferece "Desfazer" (`desfazer_conversao`): o lançamento original volta igual e a linha nova do extrato entra como entrada ou gasto comum.
- Você também pode marcar uma linha como transferência à mão e escolher a outra conta.

## Saldo consolidado

- Saldo da conta = saldo inicial + entradas recebidas − contas fixas pagas − gastos pagos − investimentos + transferências recebidas − enviadas. É calculado no banco (`saldos_contas()`).
- **Dashboard**: card "Saldo em contas" com o total das contas ativas, o detalhe por banco e o filtro "Todas as contas / <conta>". O filtro vale para esse card.

## Proteção dos extratos

- `.gitignore` passa a ignorar `*.ofx`, `*.qfx` e as pastas `extratos/` e `importar/`. Os arquivos de teste ficam em `src/features/importacao/__exemplos__/`, **anonimizados**: nomes, CPF, agência e conta trocados, valores inventados.

## Testes

- OFX SGML em windows-1252 com acento ("PADARIA SÃO JOÃO") e OFX XML em UTF-8.
- `DTPOSTED` com fuso continua no mesmo dia.
- Reimportação: o mesmo arquivo gera as mesmas chaves, e com chaves existentes tudo é pulado.
- Dois lançamentos idênticos no mesmo arquivo geram chaves diferentes (`#1`, `#2`).
- Transferência: par entre dois arquivos de bancos diferentes; 3 dias de diferença não casa; mesma conta não casa.
- Saldo da conta com todos os tipos de movimento.
- B2+: planilha modelo, mapeamento, débito/crédito em colunas separadas, cada CSV de banco.
