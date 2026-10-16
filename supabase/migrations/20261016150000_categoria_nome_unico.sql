-- =====================================================================
-- Categorias: nome único por usuário e tipo, ignorando maiúsculas, acentos e pontuação.
-- ("Casa" = "casa" = "CASA!"; "Saúde" = "Saude")
-- Falha se já houver duplicadas: limpar antes.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- Mesma regra do app (src/lib/categorizar.ts → normalizar):
-- sem acento, minúsculas, tudo que não é letra/número vira um espaço, sem espaços nas pontas.
-- unaccent() sozinha não é IMMUTABLE; com o dicionário explícito e schema fixo, pode ser usada em índice.
create or replace function public.nome_normalizado(p_nome text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_nome)), '[^a-z0-9]+', ' ', 'g'));
$$;

-- O erro de duplicado continua sendo 23505 (unique_violation), que o app já traduz para
-- "Já existe uma categoria com esse nome."
create unique index categorias_nome_normalizado_unico
  on public.categorias (user_id, tipo, public.nome_normalizado(nome));
