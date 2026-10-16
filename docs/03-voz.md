# 03 — Lançamento por voz

A pessoa fala ("gastei 52 e 90 no mercado no débito e 30 de uber"), confere os itens que a IA entendeu e confirma. Nada é gravado sem confirmação.

## Arquitetura

```
Navegador ──(áudio + token do usuário)──▶ Supabase Edge Function "voz"
                                              │ 1. valida o login
                                              │ 2. confere o limite diário (tabela voz_uso)
                                              │ 3. Groq Whisper  → texto
                                              │ 4. Groq LLM (JSON com schema) → itens
Navegador ◀──────────── { transcricao, itens } ┘
   │
   └─ painel de confirmação → insert nas tabelas (com o supabase-js do usuário)
```

- A chave da Groq fica **só** nos segredos do Supabase (`GROQ_API_KEY`). Nunca no front-end nem no GitHub.
- Código pronto: `supabase/functions/voz/index.ts`.
- Modelos: `whisper-large-v3-turbo` (transcrição, aceita webm, mp3, m4a, ogg, wav) e `openai/gpt-oss-20b` (interpretação com `response_format: json_schema` + `strict: true`).
- Custo: o plano gratuito da Groq cobre o uso pessoal (até 30 min de áudio por dia fica abaixo de 10% dos limites diários). A função limita a 200 gravações por dia (`VOZ_LIMITE_DIA`). Se um dia passar ao plano pago: cerca de US$ 0,0003 por gravação de 30 s.

## Contrato da função

`POST {SUPABASE_URL}/functions/v1/voz`

Cabeçalhos: `Authorization: Bearer <access_token do usuário>`, `apikey: <chave publishable/anon>`.

Corpo `multipart/form-data`:

| Campo | Tipo | Obrigatório | Exemplo |
| --- | --- | --- | --- |
| `audio` | arquivo | sim | Blob do MediaRecorder (`audio/webm`) |
| `modo` | texto | não | `financeiro` (padrão) ou `tarefas` |
| `categorias_gasto` | JSON (lista) | não | `["Alimentação","Casa","Pets","Outros"]` |
| `categorias_investimento` | JSON (lista) | não | `["Renda fixa","Cripto"]` |

Resposta modo financeiro:

```json
{
  "transcricao": "gastei 52 e 90 no mercado no débito e 30 de uber",
  "itens": [
    { "tipo": "gasto", "descricao": "Mercado", "valor": 52.9, "categoria": "Alimentação",
      "parcelas": 1, "forma_pagamento": "debito", "data": null },
    { "tipo": "gasto", "descricao": "Uber", "valor": 30, "categoria": "Transporte",
      "parcelas": 1, "forma_pagamento": "nao_informado", "data": null }
  ]
}
```

`tipo`: `gasto` | `entrada` | `investimento` (negativo = resgate) | `conta_fixa`.

Resposta modo tarefas:

```json
{ "transcricao": "...", "tarefas": [ { "titulo": "Ligar para o contador", "nota": null, "prioridade": "alta", "data": "2026-10-17" } ] }
```

Erros: `401` sem login, `413` áudio grande, `429` limite diário, `503` IA ocupada, `502` falha na transcrição. Corpo `{ "erro": "mensagem para o usuário" }`. Se a interpretação falhar, a função devolve `200` com a transcrição e `itens: []` para o front oferecer o preenchimento manual.

## Comportamento no navegador

1. Botão de voz (barra fixa no topo do Financeiro, card "Lançar por voz" no dashboard e botão flutuante no celular).
2. Pedir microfone com `getUserMedia({ audio: true })`. Formato: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` (Safari), o primeiro suportado por `MediaRecorder.isTypeSupported`.
3. Gravar no máximo 30 s, com contador `00:12` e equalizador (Web Audio `AnalyserNode`).
4. Legenda ao vivo opcional com `webkitSpeechRecognition` (`pt-BR`), só visual; se o navegador não suportar, apenas grava.
5. Se em 2,5 s nenhum som chegar ao analisador, religar o microfone uma vez (alguns celulares entregam a trilha muda).
6. Ao parar: estado "Processando…", enviar com timeout de 25 s (`AbortController`).
7. Painel de confirmação: uma linha por item com tipo (muda a cor), descrição, valor, categoria, parcelas e pagamento editáveis; remover item; adicionar item; total previsto ("− R$ 82,90").
8. Confirmar: inserir cada item na tabela do seu tipo, no mês selecionado, com `origem = 'voz'`; itens com parcelas > 1 passam pelo parcelamento; se a pessoa mudou a categoria, gravar a regra. Depois animar o "Disponível para gastar".
9. Ao cancelar ou sair da tela, parar todas as trilhas do microfone e fechar o `AudioContext`.

## Teste rápido da função (depois do deploy)

```bash
# token: copie de supabase.auth.getSession() no console do app logado
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/voz" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "apikey: <PUBLISHABLE_OU_ANON_KEY>" \
  -F "audio=@teste.webm" -F "modo=financeiro"
```
