-- Fase 1 do Forms Transp / Pedidos:
-- persistência dos pedidos (carga diária Intelipost) + campos operacionais
-- (resposta da transportadora) + log de tentativa bloqueada de alteração
-- de campo já respondido (item 7).

create table if not exists public.pedidos (
  id text primary key default gen_random_uuid()::text,

  -- chave única de negócio
  pedido text not null,

  -- campos de origem (upsert diário via API da Intelipost)
  "nomeDestinatario" text not null,
  "canalVendas" text not null,
  "cidadeDestinatario" text not null,
  uf text not null,
  "cepDestinatario" text not null,
  "pedidoDeVenda" text not null,
  "codigoRastreio" text,
  "notaFiscal" text,
  "metodoEnvio" text,
  "transportadoraId" text not null,
  "valorNota" numeric(12, 2),
  "pesoFisico" numeric(10, 3),
  "chaveNota" text,

  -- Data Criação da Intelipost. Define a janela dos 45 dias da Base Completa.
  -- NÃO é o "createdAt" (esse continua sendo a data de criação do registro no nosso banco).
  "dataCriacaoPedido" timestamptz not null,

  -- Data Entrega da Intelipost. Não editável pela transportadora; determina
  -- se o pedido está finalizado (IS NOT NULL = finalizado).
  "dataEntregaOrigem" timestamptz,

  "origemAtualizadoEm" timestamptz not null default now(),

  -- campos operacionais (preenchidos pela transportadora via upload de devolução)
  "dataColetaProcessamento" timestamptz,
  "dataPrevisao" timestamptz,
  "prazoEntregaDiasUteis" integer,
  "dataEntrega" timestamptz, -- DATA DE ENTREGA operacional, preenchida pela transportadora
  "statusAtual" text,
  ocorrencia text,
  "motivoDevolucao" text,
  "slaStatus" text,
  "justificativaAtraso" text,
  "novaDataPrevisao" timestamptz,
  "dataResolucaoDevolucao" timestamptz,
  "operacionalAtualizadoEm" timestamptz,

  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),

  constraint "pedidos_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete restrict
    on update cascade
);

create unique index if not exists "pedidos_pedido_key"
  on public.pedidos (pedido);

create index if not exists "pedidos_transportadoraId_dataEntregaOrigem_idx"
  on public.pedidos ("transportadoraId", "dataEntregaOrigem");

create index if not exists "pedidos_dataCriacaoPedido_idx"
  on public.pedidos ("dataCriacaoPedido");

create table if not exists public.pedido_field_change_attempts (
  id text primary key default gen_random_uuid()::text,
  "pedidoId" text not null,
  "transportadoraId" text not null,
  "userId" text,
  campo text not null,
  "valorAtual" text,
  "valorTentado" text,
  status text not null default 'blocked',
  "createdAt" timestamptz not null default now(),

  constraint "pedido_field_change_attempts_pedidoId_fkey"
    foreign key ("pedidoId")
    references public.pedidos (id)
    on delete cascade
    on update cascade,
  constraint "pedido_field_change_attempts_transportadoraId_fkey"
    foreign key ("transportadoraId")
    references public.transportadoras (id)
    on delete restrict
    on update cascade,
  constraint "pedido_field_change_attempts_userId_fkey"
    foreign key ("userId")
    references public.app_users (id)
    on delete set null
    on update cascade
);

create index if not exists "pedido_field_change_attempts_pedidoId_idx"
  on public.pedido_field_change_attempts ("pedidoId");

create index if not exists "pedido_field_change_attempts_transportadoraId_createdAt_idx"
  on public.pedido_field_change_attempts ("transportadoraId", "createdAt");

drop trigger if exists set_pedidos_updated_at on public.pedidos;
create trigger set_pedidos_updated_at
before update on public.pedidos
for each row execute function public.set_updated_at();

alter table public.pedidos enable row level security;
alter table public.pedido_field_change_attempts enable row level security;

revoke all on table public.pedidos from anon, authenticated;
revoke all on table public.pedido_field_change_attempts from anon, authenticated;
