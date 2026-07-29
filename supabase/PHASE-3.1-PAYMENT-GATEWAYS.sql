-- WOMEN RISE LEGACY — PHASE 3.1 PAYMENT GATEWAY MANAGER
-- Run after PHASE-3-SETUP-ALL.sql. Safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique check (provider in ('stripe','paypal','bank_transfer')),
  display_name text not null,
  mode text not null default 'test' check (mode in ('test','live')),
  is_enabled boolean not null default false,
  is_connected boolean not null default false,
  credentials_encrypted text,
  public_config jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_gateway_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_event_id text,
  event_type text not null,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

insert into public.payment_gateway_configs(provider,display_name,mode,is_enabled,is_connected,public_config,settings)
values
  ('stripe','Credit or debit card','test',false,false,'{"currency":"usd"}'::jsonb,'{"supportsRecurring":true}'::jsonb),
  ('paypal','PayPal','test',false,false,'{"currency":"usd"}'::jsonb,'{"supportsRecurring":false}'::jsonb),
  ('bank_transfer','Bank transfer','live',false,false,'{"currency":"usd"}'::jsonb,'{"supportsRecurring":false,"instructions":"Use your donation reference in the transfer memo."}'::jsonb)
on conflict(provider) do nothing;

drop trigger if exists set_payment_gateway_configs_updated_at on public.payment_gateway_configs;
create trigger set_payment_gateway_configs_updated_at
before update on public.payment_gateway_configs
for each row execute procedure public.set_updated_at();

create index if not exists idx_payment_gateway_enabled on public.payment_gateway_configs(is_enabled,is_connected,provider);
create index if not exists idx_payment_gateway_events_created on public.payment_gateway_events(provider,created_at desc);

alter table public.payment_gateway_configs enable row level security;
alter table public.payment_gateway_events enable row level security;

-- No browser-facing policies are intentionally created. The Express backend uses
-- the Supabase service role and exposes only sanitized public configuration.

-- Add provider reference metadata for manual/offline reconciliation.
alter table public.donations add column if not exists provider_reference text;
alter table public.donations add column if not exists admin_note text;

create index if not exists idx_donations_provider_reference on public.donations(payment_provider,provider_reference);
