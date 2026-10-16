-- =====================================================================
-- Planejamento (orçamento por grupos) — docs/06-planejamento.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Grupos do planejamento (globais por usuário; a % de cada mês fica no plano)
--    chave identifica os 5 grupos padrão; grupos criados pelo usuário têm chave null.
-- ---------------------------------------------------------------------
create table public.planejamento_grupos (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  nome               text not null check (char_length(nome) between 1 and 40),
  cor                text not null default '#64748b',
  percentual_padrao  numeric(5,2) not null default 0 check (percentual_padrao between 0 and 100),
  ordem              int not null default 0,
  chave              text check (chave in ('essenciais','lazer','educacao','liberdade','reserva')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),          -- alvo das FKs compostas (impede apontar para grupo de outra pessoa)
  unique (user_id, chave)
);
create unique index planejamento_grupos_nome_unico
  on public.planejamento_grupos (user_id, public.nome_normalizado(nome));

-- ---------------------------------------------------------------------
-- 2) Cada categoria pertence a (no máximo) um grupo
-- ---------------------------------------------------------------------
alter table public.categorias
  add column grupo_id uuid,
  add constraint categorias_grupo_fk foreign key (grupo_id, user_id)
    references public.planejamento_grupos (id, user_id) on delete set null (grupo_id);

-- ---------------------------------------------------------------------
-- 3) Plano do mês: renda prevista + % de cada grupo
--    Mês sem plano usa o último plano salvo antes dele (regra no app).
-- ---------------------------------------------------------------------
create table public.planejamentos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  ano             int  not null check (ano between 2000 and 2100),
  mes             int  not null check (mes between 1 and 12),
  renda_prevista  numeric(14,2) not null default 0 check (renda_prevista >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, ano, mes)
);

create table public.planejamento_percentuais (
  planejamento_id  uuid not null,
  grupo_id         uuid not null,
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  percentual       numeric(5,2) not null default 0 check (percentual between 0 and 100),
  primary key (planejamento_id, grupo_id),
  foreign key (planejamento_id, user_id) references public.planejamentos (id, user_id) on delete cascade,
  foreign key (grupo_id, user_id) references public.planejamento_grupos (id, user_id) on delete cascade
);

create index planejamentos_user_periodo on public.planejamentos (user_id, ano, mes);
create index categorias_grupo           on public.categorias (grupo_id) where grupo_id is not null;

create trigger t_planejamento_grupos_upd before update on public.planejamento_grupos for each row execute function public.set_updated_at();
create trigger t_planejamentos_upd       before update on public.planejamentos       for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) RLS (mesmo padrão das outras tabelas)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['planejamento_grupos','planejamentos','planejamento_percentuais']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_select_proprio" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_insert_proprio" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_update_proprio" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy "%s_delete_proprio" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Semeia grupos padrão, categorias Educação e Impostos e a ligação categoria → grupo.
--    Idempotente: não duplica grupos/categorias e só liga categorias ainda sem grupo.
--    Uso interno (trigger de cadastro e esta migration); usuários não chamam.
-- ---------------------------------------------------------------------
create or replace function public.semear_planejamento(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.planejamento_grupos (user_id, chave, nome, cor, percentual_padrao, ordem) values
    (p_user, 'essenciais', 'Despesas essenciais',   '#2f8fe8', 50, 1),
    (p_user, 'lazer',      'Lazer',                 '#a26ad5', 10, 2),
    (p_user, 'educacao',   'Educação',              '#ffa31c', 10, 3),
    (p_user, 'liberdade',  'Liberdade financeira',  '#2affbd', 20, 4),
    (p_user, 'reserva',    'Reserva de emergência', '#22d3ee', 10, 5)
  on conflict do nothing;

  insert into public.categorias (user_id, tipo, nome, cor, icone, palavras, padrao, ordem) values
  (p_user, 'gasto', 'Educação', '#ffa31c', 'graduation-cap', array[
    'educacao','escola','colegio','faculdade','universidade','mensalidade escolar','matricula','curso','cursinho',
    'material escolar','apostila','udemy','alura','coursera','idiomas','ingles','aula','professor'
  ], true, 6),
  (p_user, 'gasto', 'Impostos', '#e5484d', 'receipt', array[
    'imposto','impostos','iptu','irpf','imposto de renda','darf','das','mei','inss','iss','icms','tributo','multa'
  ], true, 7)
  on conflict do nothing;

  update public.categorias c
     set grupo_id = g.id
    from public.planejamento_grupos g
   where c.user_id = p_user
     and g.user_id = p_user
     and c.grupo_id is null
     and g.chave = case
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) in ('alimentacao','casa','saude','transporte','impostos') then 'essenciais'
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) = 'lazer'    then 'lazer'
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) = 'educacao' then 'educacao'
       when c.tipo = 'investimento' and public.nome_normalizado(c.nome) = 'reserva' then 'reserva'
       when c.tipo = 'investimento' then 'liberdade'
     end;
end;
$$;

revoke all on function public.semear_planejamento(uuid) from public, anon, authenticated;

-- Novo usuário: mesmo cadastro de antes + planejamento
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

  perform public.semear_planejamento(new.id);

  return new;
end;
$$;

-- Usuários que já existem
do $$
declare
  u uuid;
begin
  for u in select user_id from public.preferencias loop
    perform public.semear_planejamento(u);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) RPC: salva o plano do mês (renda + todas as %) de uma vez, tudo ou nada.
--    p_percentuais = {"<grupo_id>": 50, ...}. security invoker → RLS vale.
-- ---------------------------------------------------------------------
create or replace function public.salvar_planejamento(p_ano int, p_mes int, p_renda numeric, p_percentuais jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.planejamentos (ano, mes, renda_prevista) values (p_ano, p_mes, p_renda)
  on conflict (user_id, ano, mes) do update set renda_prevista = excluded.renda_prevista
  returning id into v_id;

  delete from public.planejamento_percentuais where planejamento_id = v_id;

  insert into public.planejamento_percentuais (planejamento_id, grupo_id, percentual)
  select v_id, e.key::uuid, e.value::numeric
    from jsonb_each_text(coalesce(p_percentuais, '{}'::jsonb)) e;

  return v_id;
end;
$$;

revoke all on function public.salvar_planejamento(int, int, numeric, jsonb) from public, anon;
grant execute on function public.salvar_planejamento(int, int, numeric, jsonb) to authenticated;
