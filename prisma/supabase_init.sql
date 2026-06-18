create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

create table if not exists public.transportadoras (
  id text primary key default gen_random_uuid()::text,
  nome text not null,
  cnpj text,
  "codigoSlug" text not null,
  ativo boolean not null default true,
  origem text not null default 'real',
  "tokenPublicoFormulario" text not null,
  "emailsDestinatarios" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "transportadoras_origem_check"
    check (origem in ('real', 'demo'))
);

create unique index if not exists "transportadoras_codigoSlug_key"
  on public.transportadoras ("codigoSlug");

create unique index if not exists "transportadoras_tokenPublicoFormulario_key"
  on public.transportadoras ("tokenPublicoFormulario");

create table if not exists public.app_users (
  id text primary key default gen_random_uuid()::text,
  "authUserId" uuid unique references auth.users (id) on delete set null,
  username text unique,
  email text not null,
  nome text not null,
  "passwordHash" text,
  "passwordMustChange" boolean not null default false,
  role text not null default 'carrier_operator',
  ativo boolean not null default true,
  "transportadoraId" text,
  "lastLoginAt" timestamptz,
  "passwordUpdatedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "app_users_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete set null
    on update cascade,
  constraint "app_users_role_check"
    check (role in ('internal_admin', 'internal_viewer', 'carrier_admin', 'carrier_operator'))
);

create unique index if not exists "app_users_email_key"
  on public.app_users (email);

create index if not exists "app_users_transportadoraId_idx"
  on public.app_users ("transportadoraId");

create index if not exists "app_users_role_idx"
  on public.app_users (role);

create table if not exists public.app_sessions (
  id text primary key default gen_random_uuid()::text,
  "userId" text not null,
  "tokenHash" text not null unique,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  constraint "app_sessions_userId_fkey"
    foreign key ("userId")
    references public.app_users (id)
    on delete cascade
    on update cascade
);

create index if not exists "app_sessions_userId_idx"
  on public.app_sessions ("userId");

create index if not exists "app_sessions_expiresAt_idx"
  on public.app_sessions ("expiresAt");

create table if not exists public.report_submissions (
  id text primary key default gen_random_uuid()::text,
  "transportadoraId" text not null,
  "dataReport" timestamptz not null,
  "dataResultadoDiaAnterior" timestamptz not null,
  "dataPreviaDiaAtual" timestamptz not null,
  status text not null default 'draft',
  "submittedAt" timestamptz,
  "submittedByName" text,
  "submittedByEmail" text,
  observacoes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "report_submissions_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete cascade
    on update cascade,
  constraint "report_submissions_status_check"
    check (status in ('draft', 'submitted', 'validated', 'sent'))
);

create unique index if not exists "report_submissions_transportadoraId_dataReport_key"
  on public.report_submissions ("transportadoraId", "dataReport");

create index if not exists "report_submissions_transportadoraId_dataReport_idx"
  on public.report_submissions ("transportadoraId", "dataReport");

create table if not exists public.previous_day_metrics (
  id text primary key default gen_random_uuid()::text,
  "submissionId" text not null,
  "totalPedidos" integer not null,
  "totalEntregue" integer not null,
  "totalEmAberto" integer not null,
  "totalTentativaInsucesso" integer not null,
  "totalDevolucao" integer not null,
  "totalCancelado" integer not null,
  "totalNoPrazo" integer not null,
  "totalForaDoPrazo" integer not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "previous_day_metrics_submissionId_fkey"
    foreign key ("submissionId")
    references public.report_submissions (id)
    on delete cascade
    on update cascade
);

create unique index if not exists "previous_day_metrics_submissionId_key"
  on public.previous_day_metrics ("submissionId");

create table if not exists public.current_day_preview_metrics (
  id text primary key default gen_random_uuid()::text,
  "submissionId" text not null,
  "totalPedidos" integer not null,
  "totalFinalizado" integer not null,
  "totalEmAberto" integer not null,
  "totalEntregue" integer not null,
  "totalTentativaInsucesso" integer not null,
  "totalDevolucao" integer not null,
  "totalCancelado" integer not null,
  "finalizadosNoPrazo" integer not null,
  "finalizadosForaDoPrazo" integer not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "current_day_preview_metrics_submissionId_fkey"
    foreign key ("submissionId")
    references public.report_submissions (id)
    on delete cascade
    on update cascade
);

create unique index if not exists "current_day_preview_metrics_submissionId_key"
  on public.current_day_preview_metrics ("submissionId");

create table if not exists public.previous_day_uf_metrics (
  id text primary key default gen_random_uuid()::text,
  "submissionId" text not null,
  uf text not null,
  "dentroDoPrazo" integer not null,
  "foraDoPrazo" integer not null,
  total integer not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "previous_day_uf_metrics_submissionId_fkey"
    foreign key ("submissionId")
    references public.report_submissions (id)
    on delete cascade
    on update cascade,
  constraint "previous_day_uf_metrics_uf_check"
    check (uf in ('CE', 'RN', 'PB', 'PE', 'BA'))
);

create unique index if not exists "previous_day_uf_metrics_submissionId_uf_key"
  on public.previous_day_uf_metrics ("submissionId", uf);

create table if not exists public.automation_logs (
  id text primary key default gen_random_uuid()::text,
  "transportadoraId" text,
  "dataReport" timestamptz not null,
  tipo text not null,
  status text not null,
  mensagem text not null,
  payload text,
  "createdAt" timestamptz not null default now(),
  constraint "automation_logs_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete set null
    on update cascade,
  constraint "automation_logs_status_check"
    check (status in ('success', 'skipped', 'error', 'pending'))
);

create index if not exists "automation_logs_transportadoraId_dataReport_idx"
  on public.automation_logs ("transportadoraId", "dataReport");

drop trigger if exists set_transportadoras_updated_at on public.transportadoras;
create trigger set_transportadoras_updated_at
before update on public.transportadoras
for each row execute function public.set_updated_at();

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists set_report_submissions_updated_at on public.report_submissions;
create trigger set_report_submissions_updated_at
before update on public.report_submissions
for each row execute function public.set_updated_at();

drop trigger if exists set_previous_day_metrics_updated_at on public.previous_day_metrics;
create trigger set_previous_day_metrics_updated_at
before update on public.previous_day_metrics
for each row execute function public.set_updated_at();

drop trigger if exists set_current_day_preview_metrics_updated_at on public.current_day_preview_metrics;
create trigger set_current_day_preview_metrics_updated_at
before update on public.current_day_preview_metrics
for each row execute function public.set_updated_at();

drop trigger if exists set_previous_day_uf_metrics_updated_at on public.previous_day_uf_metrics;
create trigger set_previous_day_uf_metrics_updated_at
before update on public.previous_day_uf_metrics
for each row execute function public.set_updated_at();

alter table public.transportadoras enable row level security;
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.report_submissions enable row level security;
alter table public.previous_day_metrics enable row level security;
alter table public.current_day_preview_metrics enable row level security;
alter table public.previous_day_uf_metrics enable row level security;
alter table public.automation_logs enable row level security;

revoke all on table public.transportadoras from anon, authenticated;
revoke all on table public.app_users from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;
revoke all on table public.report_submissions from anon, authenticated;
revoke all on table public.previous_day_metrics from anon, authenticated;
revoke all on table public.current_day_preview_metrics from anon, authenticated;
revoke all on table public.previous_day_uf_metrics from anon, authenticated;
revoke all on table public.automation_logs from anon, authenticated;

grant select on table public.app_users to authenticated;

drop policy if exists "app_users_select_own_profile" on public.app_users;
create policy "app_users_select_own_profile"
on public.app_users
for select
to authenticated
using ((select auth.uid()) = "authUserId");
