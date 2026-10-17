-- Restaurar backup (Configurações → "Restaurar backup"): troca TODOS os dados da pessoa pelos do arquivo,
-- numa transação só (se qualquer linha falhar, nada muda). O arquivo é gerado pelo próprio app
-- (formato "financas-backup", versão 1; ver src/lib/backup.ts).
--
-- Segurança:
-- - security invoker: roda como a pessoa logada, então o RLS de cada tabela continua valendo;
-- - user_id do arquivo é ignorado: toda linha é gravada com auth.uid();
-- - só apaga linhas da própria pessoa (where user_id = auth.uid());
-- - voz_uso (limite diário da voz) fica de fora: não entra no backup nem é apagado.

create or replace function public.restaurar_backup(p_dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  -- Ordem de inserção: quem é referenciado vem antes (a exclusão usa a ordem inversa)
  v_ordem  text[] := array[
    'preferencias', 'planejamento_grupos', 'categorias', 'categoria_regras', 'contas_bancarias',
    'planejamentos', 'planejamento_percentuais', 'entradas', 'contas_fixas', 'gastos_variaveis',
    'investimentos', 'transferencias', 'importacoes_chaves', 'metas', 'tarefas'
  ];
  v_tab    text;
  v_linhas jsonb;
  v_n      int;
  v_total  jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para restaurar o backup' using errcode = '28000';
  end if;
  if jsonb_typeof(p_dados) is distinct from 'object'
     or p_dados->>'formato' is distinct from 'financas-backup'
     or p_dados->>'versao' is distinct from '1'
     or jsonb_typeof(p_dados->'tabelas') is distinct from 'object' then
    raise exception 'Arquivo de backup inválido' using errcode = '22023';
  end if;

  for i in reverse array_length(v_ordem, 1)..1 loop
    execute format('delete from public.%I where user_id = $1', v_ordem[i]) using v_uid;
  end loop;

  foreach v_tab in array v_ordem loop
    v_linhas := coalesce(p_dados->'tabelas'->v_tab, '[]'::jsonb);
    if jsonb_typeof(v_linhas) <> 'array' then
      raise exception 'Arquivo de backup inválido (%)', v_tab using errcode = '22023';
    end if;
    -- Cada linha passa a ser da pessoa logada
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', v_uid)), '[]'::jsonb)
      into v_linhas
      from jsonb_array_elements(v_linhas) e;
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1)', v_tab, v_tab)
      using v_linhas;
    get diagnostics v_n = row_count;
    v_total := v_total || jsonb_build_object(v_tab, v_n);
  end loop;

  return v_total;
end;
$$;

revoke all on function public.restaurar_backup(jsonb) from public, anon;
grant execute on function public.restaurar_backup(jsonb) to authenticated;
