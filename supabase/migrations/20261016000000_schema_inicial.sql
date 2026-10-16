-- =====================================================================
-- Esquema inicial do app de finanças pessoais
-- Banco: Supabase (Postgres 15+)
-- Regras: todo dado pertence a um usuário (user_id = auth.uid()).
--         RLS ligado em TODAS as tabelas. Nada de linhas "sem dono".
-- Mês é número (1..12) + ano. Datas são DATE locais (AAAA-MM-DD).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Função utilitária: mantém updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Preferências do usuário (1 linha por usuário)
-- ---------------------------------------------------------------------
create table public.preferencias (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  moeda          text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  idioma         text not null default 'pt-BR' check (idioma in ('pt-BR','en-US','es-ES')),
  tema           text not null default 'dark' check (tema in ('dark','light')),
  so_pago        boolean not null default false,   -- "contar só o que foi pago"
  saldo_inicial  numeric(14,2) not null default 0, -- "já tinha guardado" (patrimônio)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Categorias (gastos, contas fixas e investimentos)
-- ---------------------------------------------------------------------
create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  tipo        text not null check (tipo in ('gasto','investimento')),
  nome        text not null check (char_length(nome) between 1 and 40),
  cor         text not null default '#64748b',
  icone       text not null default 'tag',          -- nome do ícone lucide
  palavras    text[] not null default '{}',         -- palavras-chave p/ auto-categorizar (sem acento, minúsculas)
  padrao      boolean not null default false,       -- criada pelo sistema
  oculta      boolean not null default false,       -- usuário "removeu" uma padrão
  ordem       int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, tipo, nome)
);

-- Regra manual: "sempre que o gasto se chamar X, a categoria é Y"
create table public.categoria_regras (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  termo          text not null,                     -- nome do lançamento normalizado (sem acento, minúsculo, trim)
  categoria_id   uuid not null references public.categorias on delete cascade,
  created_at     timestamptz not null default now(),
  unique (user_id, termo)
);

-- ---------------------------------------------------------------------
-- Lançamentos financeiros
-- ---------------------------------------------------------------------
create table public.entradas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  ano         int  not null check (ano between 2000 and 2100),
  mes         int  not null check (mes between 1 and 12),
  descricao   text not null default 'Nova entrada',
  valor       numeric(14,2) not null default 0 check (valor >= 0),
  recebido    boolean not null default true,       -- false = "A receber" (não entra no disponível)
  data        date,
  origem      text not null default 'manual' check (origem in ('manual','voz','replicado','saldo_anterior')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.contas_fixas (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  ano             int  not null check (ano between 2000 and 2100),
  mes             int  not null check (mes between 1 and 12),
  descricao       text not null default 'Nova conta',
  valor           numeric(14,2) not null default 0 check (valor >= 0),
  pago            boolean not null default false,
  vencimento      date,
  categoria_id    uuid references public.categorias on delete set null,
  grupo_parcela   uuid,                              -- todas as parcelas de uma compra compartilham este id
  parcela_num     int check (parcela_num >= 1),
  parcela_total   int check (parcela_total between 1 and 48),
  origem          text not null default 'manual' check (origem in ('manual','voz','replicado','parcela')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((parcela_num is null) = (parcela_total is null))
);

create table public.gastos_variaveis (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  ano             int  not null check (ano between 2000 and 2100),
  mes             int  not null check (mes between 1 and 12),
  descricao       text not null default 'Novo gasto',
  valor           numeric(14,2) not null default 0 check (valor >= 0),
  pago            boolean not null default false,
  forma_pagamento text not null default 'pix' check (forma_pagamento in ('pix','debito','credito','dinheiro')),
  cartao          text,                              -- banco/cartão quando débito/crédito
  data            date,
  categoria_id    uuid references public.categorias on delete set null,
  observacao      text,
  grupo_parcela   uuid,
  parcela_num     int check (parcela_num >= 1),
  parcela_total   int check (parcela_total between 1 and 48),
  origem          text not null default 'manual' check (origem in ('manual','voz','replicado','parcela','saldo_anterior')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check ((parcela_num is null) = (parcela_total is null))
);

create table public.investimentos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  ano           int  not null check (ano between 2000 and 2100),
  mes           int  not null check (mes between 1 and 12),
  descricao     text not null default 'Novo aporte',
  valor         numeric(14,2) not null default 0,    -- positivo = aporte, negativo = resgate
  data          date,
  categoria_id  uuid references public.categorias on delete set null,
  destino       text,                                -- para resgates: conta corrente, reserva, gasto planejado
  origem        text not null default 'manual' check (origem in ('manual','voz','ajuste')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nome        text not null default 'Nova meta',
  valor_alvo  numeric(14,2) not null default 1000 check (valor_alvo >= 0),
  reservado   numeric(14,2) not null default 0 check (reservado >= 0),
  prazo       date,
  concluida   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Tarefas (módulo de agenda)
-- ---------------------------------------------------------------------
create table public.tarefas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  titulo      text not null check (char_length(titulo) between 1 and 300),
  nota        text check (char_length(nota) <= 4000),
  tipo        text not null default 'tarefa' check (tipo in ('tarefa','ideia','compra','financeiro','lembrete')),
  prioridade  text not null default 'media' check (prioridade in ('alta','media','baixa')),
  concluida   boolean not null default false,
  data        date not null default current_date,
  tempo_foco  int not null default 0 check (tempo_foco >= 0),   -- segundos
  timer_inicio timestamptz,                                       -- timer rodando (sobrevive a recarregar)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Uso da voz (limite diário por usuário, protege a cota da IA)
-- ---------------------------------------------------------------------
create table public.voz_uso (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  modo        text not null check (modo in ('financeiro','tarefas')),
  segundos    numeric(6,2),
  ok          boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index entradas_user_periodo         on public.entradas         (user_id, ano, mes);
create index contas_fixas_user_periodo     on public.contas_fixas     (user_id, ano, mes);
create index gastos_variaveis_user_periodo on public.gastos_variaveis (user_id, ano, mes);
create index investimentos_user_periodo    on public.investimentos    (user_id, ano, mes);
create index contas_fixas_grupo            on public.contas_fixas     (grupo_parcela) where grupo_parcela is not null;
create index gastos_variaveis_grupo        on public.gastos_variaveis (grupo_parcela) where grupo_parcela is not null;
create index tarefas_user_data             on public.tarefas          (user_id, data);
create index voz_uso_user_dia              on public.voz_uso          (user_id, created_at);
create index categorias_user_tipo          on public.categorias       (user_id, tipo);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
create trigger t_preferencias_upd     before update on public.preferencias     for each row execute function public.set_updated_at();
create trigger t_entradas_upd         before update on public.entradas         for each row execute function public.set_updated_at();
create trigger t_contas_fixas_upd     before update on public.contas_fixas     for each row execute function public.set_updated_at();
create trigger t_gastos_upd           before update on public.gastos_variaveis for each row execute function public.set_updated_at();
create trigger t_investimentos_upd    before update on public.investimentos    for each row execute function public.set_updated_at();
create trigger t_metas_upd            before update on public.metas            for each row execute function public.set_updated_at();
create trigger t_tarefas_upd          before update on public.tarefas          for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera o que é seu
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'preferencias','categorias','categoria_regras','entradas','contas_fixas',
    'gastos_variaveis','investimentos','metas','tarefas'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_proprio" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_insert_proprio" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_update_proprio" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_delete_proprio" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- voz_uso: o usuário só lê e insere o próprio uso (não altera nem apaga)
alter table public.voz_uso enable row level security;
create policy "voz_uso_select_proprio" on public.voz_uso for select to authenticated using ((select auth.uid()) = user_id);
create policy "voz_uso_insert_proprio" on public.voz_uso for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Novo usuário: cria preferências e categorias padrão
-- ---------------------------------------------------------------------
create or replace function public.criar_dados_iniciais()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.preferencias (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.categorias (user_id, tipo, nome, cor, icone, palavras, padrao, ordem) values
  (new.id, 'gasto', 'Alimentação', '#f97316', 'utensils', array[
    'alimentacao','mercado','supermercado','mercadinho','atacadao','assai','carrefour','pao de acucar','hortifruti','feira','acougue',
    'ifood','rappi','ze delivery','delivery','lanche','hamburguer','mcdonalds','burger king','pizza','esfiha','pastel','marmita',
    'restaurante','almoco','janta','jantar','cafe','cafeteria','padaria','acai','sorvete','churrasco','bar','comida','bebida','cerveja'
  ], true, 1),
  (new.id, 'gasto', 'Casa', '#22d3ee', 'house', array[
    'casa','aluguel','condominio','agua','luz','energia','enel','cemig','copel','sabesp','sanepar','gas','internet','wifi','claro','vivo','tim',
    'moveis','sofa','geladeira','fogao','microondas','decoracao','material de construcao','faxina','diarista','lavanderia','reforma','manutencao'
  ], true, 2),
  (new.id, 'gasto', 'Saúde', '#2affbd', 'heart-pulse', array[
    'saude','farmacia','drogasil','droga raia','pague menos','panvel','remedio','medicamento','consulta','medico','hospital','clinica',
    'dentista','psicologo','terapia','exame','laboratorio','vacina','oculos','fisioterapia','academia','nutricionista','plano de saude'
  ], true, 3),
  (new.id, 'gasto', 'Lazer', '#a26ad5', 'gamepad-2', array[
    'lazer','cinema','netflix','spotify','prime video','disney','hbo','youtube','streaming','assinatura','steam','playstation','xbox','jogo',
    'ingresso','show','festa','viagem','hotel','pousada','airbnb','parque','praia','passeio','presente','shopping','roupa','perfume','livro'
  ], true, 4),
  (new.id, 'gasto', 'Transporte', '#2f8fe8', 'car', array[
    'transporte','uber','99','taxi','onibus','metro','trem','passagem','combustivel','gasolina','etanol','diesel','posto',
    'estacionamento','pedagio','lavagem','mecanico','oficina','pneu','seguro auto','ipva','licenciamento','carro','moto'
  ], true, 5),
  (new.id, 'gasto', 'Outros', '#64748b', 'ellipsis', '{}', true, 99),
  (new.id, 'investimento', 'Renda fixa',   '#2affbd', 'landmark',  '{}', true, 1),
  (new.id, 'investimento', 'Ações e FIIs', '#ffa31c', 'line-chart','{}', true, 2),
  (new.id, 'investimento', 'Cripto',       '#a26ad5', 'bitcoin',   '{}', true, 3),
  (new.id, 'investimento', 'Reserva',      '#2f8fe8', 'piggy-bank','{}', true, 4);

  return new;
end;
$$;

create trigger t_auth_novo_usuario
  after insert on auth.users
  for each row execute function public.criar_dados_iniciais();

-- ---------------------------------------------------------------------
-- RPC: resumo do mês (mesma regra do cartão "Disponível para gastar")
-- Usa as permissões de quem chama (security invoker) -> respeita RLS.
-- ---------------------------------------------------------------------
create or replace function public.resumo_mes(p_ano int, p_mes int)
returns table (
  entradas_recebidas numeric,
  entradas_a_receber numeric,
  contas_fixas       numeric,
  gastos_variaveis   numeric,
  investido          numeric,
  disponivel         numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with pref as (
    select coalesce((select so_pago from public.preferencias where user_id = auth.uid()), false) as so_pago
  ),
  e as (
    select
      coalesce(sum(valor) filter (where recebido), 0)     as rec,
      coalesce(sum(valor) filter (where not recebido), 0) as arec
    from public.entradas where ano = p_ano and mes = p_mes
  ),
  f as (
    select coalesce(sum(valor) filter (where pago or not (select so_pago from pref)), 0) as v
    from public.contas_fixas where ano = p_ano and mes = p_mes
  ),
  g as (
    select coalesce(sum(valor) filter (where pago or not (select so_pago from pref)), 0) as v
    from public.gastos_variaveis where ano = p_ano and mes = p_mes
  ),
  i as (
    select coalesce(sum(valor), 0) as v
    from public.investimentos where ano = p_ano and mes = p_mes
  )
  select e.rec, e.arec, f.v, g.v, i.v, e.rec - f.v - g.v - i.v
  from e, f, g, i;
$$;

grant execute on function public.resumo_mes(int, int) to authenticated;
