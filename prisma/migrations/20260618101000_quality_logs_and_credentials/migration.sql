alter table public.app_users
add column if not exists "credentialSentAt" timestamp(3),
add column if not exists "credentialSentBy" text;

create table if not exists public.submission_quality_logs (
  id text primary key,
  "transportadoraId" text not null,
  "userId" text,
  "dataReport" timestamp(3) not null,
  action text not null,
  status text not null default 'blocked',
  reasons text not null,
  "payloadSummary" text,
  "createdAt" timestamp(3) not null default current_timestamp,
  constraint submission_quality_logs_transportadoraId_fkey
    foreign key ("transportadoraId") references public.transportadoras(id) on delete cascade on update cascade,
  constraint submission_quality_logs_userId_fkey
    foreign key ("userId") references public.app_users(id) on delete set null on update cascade
);

alter table public.submission_quality_logs enable row level security;

create index if not exists submission_quality_logs_transportadoraId_dataReport_idx
on public.submission_quality_logs ("transportadoraId", "dataReport");

create index if not exists submission_quality_logs_userId_idx
on public.submission_quality_logs ("userId");

create index if not exists submission_quality_logs_createdAt_idx
on public.submission_quality_logs ("createdAt");
