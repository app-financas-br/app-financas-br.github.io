-- =====================================================================
-- Fase 1: parcelamento transacional + controle da virada do mês
-- PROPOSTA — ainda não aplicada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Virada do mês: "perguntar uma vez por mês por usuário"
--    Guarda o último mês (AAAAMM, ex.: 202611) em que a pergunta foi feita.
--    Fica no banco (e não no navegador) para não perguntar de novo em outro aparelho.
-- ---------------------------------------------------------------------
alter table public.preferencias
  add column virada_perguntada int check (virada_perguntada between 200001 and 210012);

-- ---------------------------------------------------------------------
-- 2) Parcelar um gasto ou conta fixa em N vezes (2 a 12), tudo ou nada.
--    - O item atual vira a parcela 1; as parcelas 2..N vão para os meses seguintes
--      (virando o ano), com o mesmo dia limitado ao último dia do mês.
--    - Centavos exatos: cada parcela = floor(total / N); a última fica com a sobra.
--    - Uma parcela não pode ser reparcelada.
--    - security invoker: roda com as permissões de quem chama, então o RLS vale
--      (ninguém parcela item de outra pessoa).
--    Devolve o grupo_parcela criado.
-- ---------------------------------------------------------------------
create or replace function public.parcelar_lancamento(p_tabela text, p_id uuid, p_parcelas int)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_grupo  uuid := gen_random_uuid();
  v_total  bigint;
  v_base   bigint;
  v_ultima bigint;
  v_ini    date;     -- 1º dia do mês da parcela 1
  v_mes    date;     -- 1º dia do mês da parcela i
  v_dia    int;      -- dia original da data/vencimento (null se não houver)
  v_data   date;
  g        public.gastos_variaveis%rowtype;
  c        public.contas_fixas%rowtype;
begin
  if p_parcelas is null or p_parcelas < 2 or p_parcelas > 12 then
    raise exception 'Número de parcelas deve ser de 2 a 12' using errcode = '22023';
  end if;

  if p_tabela = 'gastos_variaveis' then
    select * into g from public.gastos_variaveis where id = p_id for update;
    if not found then raise exception 'Lançamento não encontrado' using errcode = 'P0002'; end if;
    if g.grupo_parcela is not null then raise exception 'Uma parcela não pode ser reparcelada' using errcode = '22023'; end if;

    v_total  := round(g.valor * 100);
    v_base   := v_total / p_parcelas;                  -- divisão inteira = floor (valor >= 0)
    v_ultima := v_total - v_base * (p_parcelas - 1);
    v_ini    := make_date(g.ano, g.mes, 1);
    v_dia    := extract(day from g.data)::int;

    update public.gastos_variaveis
       set valor = v_base / 100.0, grupo_parcela = v_grupo, parcela_num = 1, parcela_total = p_parcelas
     where id = p_id;

    for i in 2..p_parcelas loop
      v_mes  := (v_ini + make_interval(months => i - 1))::date;
      v_data := case when v_dia is null then null
                     else make_date(extract(year from v_mes)::int, extract(month from v_mes)::int,
                                    least(v_dia, extract(day from (v_mes + interval '1 month - 1 day'))::int)) end;
      insert into public.gastos_variaveis
        (user_id, ano, mes, descricao, valor, pago, forma_pagamento, cartao, data, categoria_id, observacao,
         grupo_parcela, parcela_num, parcela_total, origem)
      values
        (g.user_id, extract(year from v_mes)::int, extract(month from v_mes)::int, g.descricao,
         (case when i = p_parcelas then v_ultima else v_base end) / 100.0,
         false, g.forma_pagamento, g.cartao, v_data, g.categoria_id, g.observacao,
         v_grupo, i, p_parcelas, 'parcela');
    end loop;

  elsif p_tabela = 'contas_fixas' then
    select * into c from public.contas_fixas where id = p_id for update;
    if not found then raise exception 'Lançamento não encontrado' using errcode = 'P0002'; end if;
    if c.grupo_parcela is not null then raise exception 'Uma parcela não pode ser reparcelada' using errcode = '22023'; end if;

    v_total  := round(c.valor * 100);
    v_base   := v_total / p_parcelas;
    v_ultima := v_total - v_base * (p_parcelas - 1);
    v_ini    := make_date(c.ano, c.mes, 1);
    v_dia    := extract(day from c.vencimento)::int;

    update public.contas_fixas
       set valor = v_base / 100.0, grupo_parcela = v_grupo, parcela_num = 1, parcela_total = p_parcelas
     where id = p_id;

    for i in 2..p_parcelas loop
      v_mes  := (v_ini + make_interval(months => i - 1))::date;
      v_data := case when v_dia is null then null
                     else make_date(extract(year from v_mes)::int, extract(month from v_mes)::int,
                                    least(v_dia, extract(day from (v_mes + interval '1 month - 1 day'))::int)) end;
      insert into public.contas_fixas
        (user_id, ano, mes, descricao, valor, pago, vencimento, categoria_id,
         grupo_parcela, parcela_num, parcela_total, origem)
      values
        (c.user_id, extract(year from v_mes)::int, extract(month from v_mes)::int, c.descricao,
         (case when i = p_parcelas then v_ultima else v_base end) / 100.0,
         false, v_data, c.categoria_id,
         v_grupo, i, p_parcelas, 'parcela');
    end loop;

  else
    raise exception 'Tabela inválida: %', p_tabela using errcode = '22023';
  end if;

  return v_grupo;
end;
$$;

revoke all on function public.parcelar_lancamento(text, uuid, int) from public, anon;
grant execute on function public.parcelar_lancamento(text, uuid, int) to authenticated;
