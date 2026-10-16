-- =====================================================================
-- Importação: sentido da transferência
-- A linha do extrato pode ser a ponta que RECEBE (crédito). A transferência passa a
-- sair de conta_origem_id quando informado (padrão: conta_id); a chave da linha
-- continua registrada na conta do extrato (conta_id).
-- =====================================================================

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
          coalesce(v_par, gen_random_uuid()), v_ano, v_mes, v_data, it->>'descricao', v_valor, coalesce((it->>'conta_origem_id')::uuid, v_conta),
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
