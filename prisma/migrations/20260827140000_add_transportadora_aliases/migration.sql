-- DE/PARA de nomes de transportadora (ex.: como a Intelipost chama uma
-- transportadora vs. o nome oficial já cadastrado em `transportadoras`).
-- Não altera nenhum nome oficial nem cria transportadora nova - só
-- adiciona apelidos que resolvem para um cadastro já existente.
--
-- BEGIN/COMMIT explícitos: por padrão o Postgres/Prisma não garante que
-- uma migration inteira seja "tudo ou nada" - e esta migration tem um
-- seed que pode falhar de propósito (codigoSlug ausente). Sem isso, uma
-- falha no meio do seed deixaria alias(es) anteriores já commitados.
begin;

create extension if not exists unaccent;

create table if not exists public.transportadora_aliases (
  id text primary key default gen_random_uuid()::text,
  "transportadoraId" text not null,
  alias text not null,
  "aliasNormalizado" text not null,
  "createdAt" timestamptz not null default now(),

  constraint "transportadora_aliases_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete cascade
    on update cascade
);

create unique index if not exists "transportadora_aliases_aliasNormalizado_key"
  on public.transportadora_aliases ("aliasNormalizado");

create index if not exists "transportadora_aliases_transportadoraId_idx"
  on public.transportadora_aliases ("transportadoraId");

alter table public.transportadora_aliases enable row level security;

revoke all on table public.transportadora_aliases from anon, authenticated;

-- ------------------------------------------------------------
-- Seed inicial (DE/PARA confirmados para a carga real da Intelipost).
--
-- Função temporária (escopo da sessão desta migration) que valida a
-- existência do codigoSlug antes de inserir. Se o codigoSlug esperado
-- não existir em `transportadoras`, a migration inteira FALHA (raise
-- exception) em vez de inserir parcialmente ou seguir em silêncio.
-- ------------------------------------------------------------
create or replace function pg_temp.seed_transportadora_alias(
  p_codigo_slug text,
  p_alias text
) returns void
language plpgsql
as $$
declare
  v_transportadora_id text;
begin
  select id into v_transportadora_id
  from public.transportadoras
  where "codigoSlug" = p_codigo_slug;

  if v_transportadora_id is null then
    raise exception
      'Seed de transportadora_aliases abortado: codigoSlug "%" nao encontrado em transportadoras (esperado para o alias "%"). Nenhum alias foi inserido por esta migration.',
      p_codigo_slug, p_alias;
  end if;

  insert into public.transportadora_aliases (id, "transportadoraId", alias, "aliasNormalizado")
  values (
    gen_random_uuid()::text,
    v_transportadora_id,
    p_alias,
    upper(unaccent(trim(p_alias)))
  )
  on conflict ("aliasNormalizado") do nothing;
end;
$$;

select pg_temp.seed_transportadora_alias('jt', 'J&T Express');
select pg_temp.seed_transportadora_alias('dialogo', 'Diálogo Logística');
select pg_temp.seed_transportadora_alias('logan', 'Logan Express');

commit;
