-- =====================================================================
-- Cartão de crédito: gasto conta no mês em que a fatura vence — docs/08-cartao.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Dados do cartão na conta bancária (só para tipo cartao_credito)
--    conta_pagamento_id: a conta corrente que paga a fatura.
--    compra_no_fechamento_proxima: compra feita NO dia do fechamento já vai para a fatura
--    seguinte (padrão, como no Nubank); desligado, entra na fatura que fecha naquele dia.
-- ---------------------------------------------------------------------
alter table public.contas_bancarias
  add column dia_fechamento     int check (dia_fechamento between 1 and 31),
  add column dia_vencimento     int check (dia_vencimento between 1 and 31),
  add column conta_pagamento_id uuid,
  add column compra_no_fechamento_proxima boolean not null default true,
  add constraint contas_bancarias_pagamento_fk foreign key (conta_pagamento_id, user_id)
    references public.contas_bancarias (id, user_id) on delete set null (conta_pagamento_id),
  add constraint contas_bancarias_campos_cartao check (
    tipo = 'cartao_credito' or (dia_fechamento is null and dia_vencimento is null and conta_pagamento_id is null)
  ),
  add constraint contas_bancarias_pagamento_outra check (conta_pagamento_id is null or conta_pagamento_id <> id);

-- ---------------------------------------------------------------------
-- 2) Gasto no cartão:
--    - data = data da COMPRA; ano/mes = mês do VENCIMENTO da fatura (calculado no app, lib/fatura.ts);
--    - o cartão é a conta_bancaria_id do gasto (tipo cartao_credito);
--    - estorno/crédito no cartão = gasto com valor NEGATIVO (abate no mês da fatura em que aparece).
-- ---------------------------------------------------------------------
alter table public.gastos_variaveis drop constraint gastos_variaveis_valor_check,
  add constraint gastos_variaveis_valor_check check (valor >= 0 or forma_pagamento = 'credito');

-- ---------------------------------------------------------------------
-- 3) Categoria padrão "Tarifas" (IOF, anuidade, juros), no grupo Despesas essenciais.
--    Mesma função de sempre (cadastro + usuários atuais), agora com Tarifas.
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
  ], true, 7),
  (p_user, 'gasto', 'Tarifas', '#f2d85d', 'landmark', array[
    'tarifa','tarifas','iof','anuidade','juros','encargos','juros rotativo','multa por atraso','taxa de servico','pacote de servicos'
  ], true, 8)
  on conflict do nothing;

  update public.categorias c
     set grupo_id = g.id
    from public.planejamento_grupos g
   where c.user_id = p_user
     and g.user_id = p_user
     and c.grupo_id is null
     and g.chave = case
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) in ('alimentacao','casa','saude','transporte','impostos','tarifas') then 'essenciais'
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) = 'lazer'    then 'lazer'
       when c.tipo = 'gasto' and public.nome_normalizado(c.nome) = 'educacao' then 'educacao'
       when c.tipo = 'investimento' and public.nome_normalizado(c.nome) = 'reserva' then 'reserva'
       when c.tipo = 'investimento' then 'liberdade'
     end;
end;
$$;

revoke all on function public.semear_planejamento(uuid) from public, anon, authenticated;

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
-- 4) Importação: aceita ano/mes da fatura, parcela "n/N" do arquivo e estorno (valor < 0).
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
    -- Cartão: o app manda ano/mes da FATURA (vencimento); sem isso, o mês da data
    v_ano   := coalesce((it->>'ano')::int, extract(year from v_data)::int);
    v_mes   := coalesce((it->>'mes')::int, extract(month from v_data)::int);
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
        -- valor < 0 = estorno no cartão (abate o gasto no mês da fatura); parcela "2/6" vem do arquivo
        insert into public.gastos_variaveis (ano, mes, data, descricao, valor, pago, forma_pagamento, categoria_id, origem, conta_bancaria_id, parcela_num, parcela_total)
        values (v_ano, v_mes, v_data, it->>'descricao', v_valor, true, coalesce(it->>'forma_pagamento', 'debito'),
                (it->>'categoria_id')::uuid, 'importado', v_conta, (it->>'parcela_num')::int, (it->>'parcela_total')::int);
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
          coalesce(v_par, gen_random_uuid()), v_ano, v_mes, v_data, it->>'descricao', v_valor, coalesce((it->>'conta_origem_id')::uuid, v_conta),
          (it->>'conta_destino_id')::uuid, 'importado',
          case when v_reg is null then null else jsonb_build_object(
            'tabela', it->>'par_tabela',
            'registro', v_reg,
            'novo', jsonb_build_object(
              'conta_id', v_conta, 'chave', it->>'chave', 'tipo', it->>'novo_tipo', 'data', coalesce(it->>'data_linha', it->>'data'),
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
