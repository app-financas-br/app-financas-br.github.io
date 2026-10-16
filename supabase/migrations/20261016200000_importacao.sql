-- =====================================================================
-- Importação de extratos e contas bancárias — docs/07-importacao.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Contas bancárias (corrente, poupança, cartão de crédito)
--    Campos do cartão (fechamento/vencimento/conta que paga) chegam na parte C.
-- ---------------------------------------------------------------------
create table public.contas_bancarias (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  nome           text not null check (char_length(nome) between 1 and 40),
  banco          text not null default '' check (char_length(banco) <= 40),
  tipo           text not null default 'corrente' check (tipo in ('corrente','poupanca','cartao_credito')),
  saldo_inicial  numeric(14,2) not null default 0,
  cor            text not null default '#2f8fe8',
  ativa          boolean not null default true,
  -- Identificação vinda do OFX (BANKID/ACCTID), para sugerir a conta ao importar de novo
  ofx_banco      text check (char_length(ofx_banco) <= 20),
  ofx_conta      text check (char_length(ofx_conta) <= 40),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)            -- alvo das FKs compostas (impede apontar para conta de outra pessoa)
);
create unique index contas_bancarias_nome_unico on public.contas_bancarias (user_id, public.nome_normalizado(nome));
create trigger t_contas_bancarias_upd before update on public.contas_bancarias for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2) Lançamentos ganham conta (opcional) e origem 'importado'
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['entradas','contas_fixas','gastos_variaveis','investimentos']
  loop
    execute format('alter table public.%I add column conta_bancaria_id uuid', t);
    execute format(
      'alter table public.%I add constraint %I foreign key (conta_bancaria_id, user_id) references public.contas_bancarias (id, user_id) on delete set null (conta_bancaria_id)',
      t, t || '_conta_bancaria_fk');
    execute format('create index %I on public.%I (conta_bancaria_id) where conta_bancaria_id is not null', t || '_conta_bancaria', t);
  end loop;
end;
$$;

alter table public.entradas         drop constraint entradas_origem_check,
  add constraint entradas_origem_check check (origem in ('manual','voz','replicado','saldo_anterior','importado'));
alter table public.contas_fixas     drop constraint contas_fixas_origem_check,
  add constraint contas_fixas_origem_check check (origem in ('manual','voz','replicado','parcela','importado'));
alter table public.gastos_variaveis drop constraint gastos_variaveis_origem_check,
  add constraint gastos_variaveis_origem_check check (origem in ('manual','voz','replicado','parcela','saldo_anterior','importado'));
alter table public.investimentos    drop constraint investimentos_origem_check,
  add constraint investimentos_origem_check check (origem in ('manual','voz','ajuste','importado'));

-- ---------------------------------------------------------------------
-- 3) Transferências entre contas do usuário (Pix/TED de um banco para outro).
--    Ficam fora de entradas e gastos: não mexem no Disponível nem no Planejamento.
--    Conta com transferência não pode ser apagada (só desativada).
-- ---------------------------------------------------------------------
create table public.transferencias (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  ano               int  not null check (ano between 2000 and 2100),
  mes               int  not null check (mes between 1 and 12),
  data              date not null,
  descricao         text not null default 'Transferência' check (char_length(descricao) <= 200),
  valor             numeric(14,2) not null check (valor > 0),
  conta_origem_id   uuid not null,
  conta_destino_id  uuid not null,
  origem            text not null default 'manual' check (origem in ('manual','importado')),
  -- Quando a transferência nasceu da conversão de uma entrada/gasto já gravado (mesmo id):
  -- {"tabela": "entradas"|"gastos_variaveis", "registro": <linha original>,
  --  "novo": {"conta_id", "tipo": "entrada"|"gasto", "descricao", "categoria_id"}}  → usado pelo "Desfazer"
  convertido_de     jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (conta_origem_id <> conta_destino_id),
  foreign key (conta_origem_id, user_id)  references public.contas_bancarias (id, user_id),
  foreign key (conta_destino_id, user_id) references public.contas_bancarias (id, user_id)
);
create index transferencias_user_periodo on public.transferencias (user_id, ano, mes);
create index transferencias_origem  on public.transferencias (conta_origem_id);
create index transferencias_destino on public.transferencias (conta_destino_id);
create trigger t_transferencias_upd before update on public.transferencias for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Chaves já importadas, por conta: FITID do OFX ("ofx:<FITID>") ou hash
--    ("h:<sha256 de conta+data+valor+descrição normalizada>#<n-ésima repetição no arquivo>").
--    Reimportar o mesmo arquivo não cria nada. Apagar o lançamento não apaga a chave
--    (o que a pessoa apagou não volta ao reimportar).
-- ---------------------------------------------------------------------
create table public.importacoes_chaves (
  user_id            uuid not null default auth.uid() references auth.users on delete cascade,
  conta_bancaria_id  uuid not null,
  chave              text not null check (char_length(chave) between 1 and 200),
  created_at         timestamptz not null default now(),
  primary key (user_id, conta_bancaria_id, chave),
  foreign key (conta_bancaria_id, user_id) references public.contas_bancarias (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contas_bancarias','transferencias','importacoes_chaves']
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
-- 6) RPC: grava a importação confirmada, tudo ou nada.
--    p_itens: [{ chave, tipo, conta_id, data, descricao, valor, categoria_id?, forma_pagamento?, ... }]
--    tipo:
--      entrada | gasto | conta_fixa | investimento → cria o lançamento na conta
--      transferencia     → valor > 0 sai de conta_id para conta_destino_id. Opcional:
--                          chave_par + conta_par_id: a outra ponta veio no mesmo lote (registra a chave dela);
--                          par_tabela + par_id + novo_tipo (+ novo_categoria_id): a outra ponta já estava gravada
--                          como entrada/gasto → vira esta transferência com o MESMO id (Desfazer restaura)
--      conta_fixa_paga   → par_id: marca a conta fixa como paga nesta conta, sem criar lançamento
--      so_chave          → só registra a chave (ex.: transferência que já existia)
--    valor: entrada/gasto/conta/transferência > 0; investimento > 0 aporte, < 0 resgate.
--    Ano/mês = mês da data. Item cuja chave já existe na conta é pulado.
--    security invoker → RLS vale. Devolve {"inseridos": n, "pulados": m, "convertidas": [ids]}.
-- ---------------------------------------------------------------------
create or replace function public.importar_lancamentos(p_itens jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  it          jsonb;
  v_data      date;
  v_ano       int;
  v_mes       int;
  v_conta     uuid;
  v_valor     numeric(14,2);
  v_ok        int;
  v_par       uuid;
  v_reg       jsonb;
  inseridos   int := 0;
  pulados     int := 0;
  convertidas jsonb := '[]'::jsonb;
begin
  for it in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb))
  loop
    v_conta := (it->>'conta_id')::uuid;
    v_data  := (it->>'data')::date;
    v_ano   := extract(year from v_data)::int;
    v_mes   := extract(month from v_data)::int;
    v_valor := (it->>'valor')::numeric;
    v_par   := (it->>'par_id')::uuid;

    insert into public.importacoes_chaves (conta_bancaria_id, chave)
    values (v_conta, it->>'chave')
    on conflict do nothing;
    get diagnostics v_ok = row_count;
    if v_ok = 0 then
      pulados := pulados + 1;
      continue;
    end if;

    case it->>'tipo'
      when 'entrada' then
        insert into public.entradas (ano, mes, data, descricao, valor, recebido, origem, conta_bancaria_id)
        values (v_ano, v_mes, v_data, it->>'descricao', v_valor, true, 'importado', v_conta);
      when 'gasto' then
        insert into public.gastos_variaveis (ano, mes, data, descricao, valor, pago, forma_pagamento, categoria_id, origem, conta_bancaria_id)
        values (v_ano, v_mes, v_data, it->>'descricao', v_valor, true, coalesce(it->>'forma_pagamento', 'debito'),
                (it->>'categoria_id')::uuid, 'importado', v_conta);
      when 'conta_fixa' then
        insert into public.contas_fixas (ano, mes, vencimento, descricao, valor, pago, categoria_id, origem, conta_bancaria_id)
        values (v_ano, v_mes, v_data, it->>'descricao', v_valor, true, (it->>'categoria_id')::uuid, 'importado', v_conta);
      when 'investimento' then
        insert into public.investimentos (ano, mes, data, descricao, valor, categoria_id, origem, conta_bancaria_id)
        values (v_ano, v_mes, v_data, it->>'descricao', v_valor, (it->>'categoria_id')::uuid, 'importado', v_conta);
      when 'conta_fixa_paga' then
        update public.contas_fixas set pago = true, conta_bancaria_id = v_conta where id = v_par;
        if not found then raise exception 'conta fixa não encontrada: %', v_par; end if;
      when 'so_chave' then
        null;
      when 'transferencia' then
        if it ? 'chave_par' then
          insert into public.importacoes_chaves (conta_bancaria_id, chave)
          values ((it->>'conta_par_id')::uuid, it->>'chave_par')
          on conflict do nothing;
        end if;

        v_reg := null;
        if it->>'par_tabela' = 'entradas' then
          delete from public.entradas where id = v_par and origem = 'importado' returning to_jsonb(entradas.*) into v_reg;
        elsif it->>'par_tabela' = 'gastos_variaveis' then
          delete from public.gastos_variaveis where id = v_par and origem = 'importado' returning to_jsonb(gastos_variaveis.*) into v_reg;
        elsif it ? 'par_tabela' then
          raise exception 'par_tabela inválida: %', it->>'par_tabela';
        end if;
        if it ? 'par_tabela' and v_reg is null then
          raise exception 'lançamento a converter não encontrado: %', v_par;
        end if;

        insert into public.transferencias (id, ano, mes, data, descricao, valor, conta_origem_id, conta_destino_id, origem, convertido_de)
        values (
          coalesce(v_par, gen_random_uuid()), v_ano, v_mes, v_data, it->>'descricao', v_valor, v_conta,
          (it->>'conta_destino_id')::uuid, 'importado',
          case when v_reg is null then null else jsonb_build_object(
            'tabela', it->>'par_tabela',
            'registro', v_reg,
            'novo', jsonb_build_object(
              'conta_id', v_conta, 'chave', it->>'chave', 'tipo', it->>'novo_tipo',
              'descricao', it->>'descricao', 'categoria_id', it->'novo_categoria_id')) end
        );
        if v_reg is not null then convertidas := convertidas || to_jsonb(v_par); end if;
      else
        raise exception 'tipo inválido: %', it->>'tipo';
    end case;
    inseridos := inseridos + 1;
  end loop;

  return jsonb_build_object('inseridos', inseridos, 'pulados', pulados, 'convertidas', convertidas);
end;
$$;

revoke all on function public.importar_lancamentos(jsonb) from public, anon;
grant execute on function public.importar_lancamentos(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 6b) RPC: desfaz a conversão em transferência (botão "Desfazer").
--     Devolve o lançamento original (mesmo id e dados) e grava a linha nova do extrato
--     como entrada/gasto comum na conta dela. Tudo ou nada.
-- ---------------------------------------------------------------------
create or replace function public.desfazer_conversao(p_transferencia_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v       public.transferencias%rowtype;
  v_novo  jsonb;
  v_conta uuid;
begin
  delete from public.transferencias where id = p_transferencia_id and convertido_de is not null returning * into v;
  if not found then
    raise exception 'transferência sem conversão para desfazer: %', p_transferencia_id;
  end if;

  if v.convertido_de->>'tabela' = 'entradas' then
    insert into public.entradas select * from jsonb_populate_record(null::public.entradas, v.convertido_de->'registro');
  else
    insert into public.gastos_variaveis select * from jsonb_populate_record(null::public.gastos_variaveis, v.convertido_de->'registro');
  end if;

  v_novo  := v.convertido_de->'novo';
  v_conta := (v_novo->>'conta_id')::uuid;
  if v_novo->>'tipo' = 'entrada' then
    insert into public.entradas (ano, mes, data, descricao, valor, recebido, origem, conta_bancaria_id)
    values (v.ano, v.mes, v.data, v_novo->>'descricao', v.valor, true, 'importado', v_conta);
  else
    insert into public.gastos_variaveis (ano, mes, data, descricao, valor, pago, forma_pagamento, categoria_id, origem, conta_bancaria_id)
    values (v.ano, v.mes, v.data, v_novo->>'descricao', v.valor, true, 'debito', (v_novo->>'categoria_id')::uuid, 'importado', v_conta);
  end if;
end;
$$;

revoke all on function public.desfazer_conversao(uuid) from public, anon;
grant execute on function public.desfazer_conversao(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7) RPC: saldo de cada conta = saldo_inicial + movimentações (todos os meses).
--    + entradas recebidas − contas fixas pagas − gastos pagos − investimentos
--    + transferências recebidas − transferências enviadas.
-- ---------------------------------------------------------------------
create or replace function public.saldos_contas()
returns table (conta_id uuid, saldo numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         c.saldo_inicial
         + coalesce((select sum(valor) from public.entradas         e where e.conta_bancaria_id = c.id and e.recebido), 0)
         - coalesce((select sum(valor) from public.contas_fixas     f where f.conta_bancaria_id = c.id and f.pago), 0)
         - coalesce((select sum(valor) from public.gastos_variaveis g where g.conta_bancaria_id = c.id and g.pago), 0)
         - coalesce((select sum(valor) from public.investimentos    i where i.conta_bancaria_id = c.id), 0)
         + coalesce((select sum(valor) from public.transferencias   t where t.conta_destino_id = c.id), 0)
         - coalesce((select sum(valor) from public.transferencias   t where t.conta_origem_id  = c.id), 0)
  from public.contas_bancarias c;
$$;

revoke all on function public.saldos_contas() from public, anon;
grant execute on function public.saldos_contas() to authenticated;
