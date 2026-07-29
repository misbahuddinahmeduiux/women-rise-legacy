-- WOMEN RISE LEGACY — PHASE 3 PRODUCTION MIGRATION
-- Run after Phase 1 and Phase 2. Idempotent and safe to re-run.

create extension if not exists pgcrypto;

-- Donation receipts, donor preferences, and authenticated ownership
alter table public.donations add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.donations add column if not exists receipt_number text unique;
alter table public.donations add column if not exists receipt_token uuid unique default gen_random_uuid();
alter table public.donations add column if not exists donor_message text;
alter table public.donations add column if not exists is_anonymous boolean not null default false;
alter table public.donations add column if not exists receipt_sent_at timestamptz;
alter table public.donations add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create sequence if not exists public.donation_receipt_seq start 1001;

create or replace function public.assign_donation_receipt()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.payment_status = 'paid' and new.receipt_number is null then
    new.receipt_number := 'WRL-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.donation_receipt_seq')::text, 6, '0');
  end if;
  if new.receipt_token is null then
    new.receipt_token := gen_random_uuid();
  end if;
  return new;
end; $$;

drop trigger if exists assign_donation_receipt_trigger on public.donations;
create trigger assign_donation_receipt_trigger before insert or update on public.donations
for each row execute procedure public.assign_donation_receipt();

-- Backfill historical paid donations
update public.donations
set receipt_number = 'WRL-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.donation_receipt_seq')::text, 6, '0')
where payment_status='paid' and receipt_number is null;

create table if not exists public.recurring_donations (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid references public.donations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  donor_email text not null,
  provider text not null default 'stripe',
  subscription_id text unique not null,
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'usd',
  interval text not null default 'monthly' check(interval in ('monthly','yearly')),
  status text not null default 'active' check(status in ('active','past_due','paused','cancelled','completed')),
  next_billing_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  transactional_email boolean not null default true,
  donation_updates boolean not null default true,
  application_updates boolean not null default true,
  event_reminders boolean not null default true,
  newsletter boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null,
  recipient_name text,
  template_key text not null,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check(status in ('queued','sending','sent','failed','cancelled')),
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_type text not null,
  application_id uuid not null,
  old_status text,
  new_status text not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key,value,description,is_public) values
('general','{"organizationName":"Women Rise Legacy Network","supportEmail":"support@womenriselegacy.org","defaultCurrency":"usd","demoMode":true}'::jsonb,'General application settings',true),
('donations','{"minimumAmount":1,"suggestedAmounts":[25,50,100,250],"receiptPrefix":"WRL"}'::jsonb,'Donation and receipt settings',true),
('features','{"membership":true,"mentorship":true,"events":true,"businessDirectory":true,"foundation":true}'::jsonb,'Feature flags',true)
on conflict(key) do nothing;

-- Updated-at triggers
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['recurring_donations','notification_preferences','email_queue','site_settings'] LOOP
    EXECUTE format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    EXECUTE format('create trigger set_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Indexes
create index if not exists idx_donations_user on public.donations(user_id,created_at desc);
create index if not exists idx_donations_receipt on public.donations(receipt_token,receipt_number);
create index if not exists idx_recurring_user on public.recurring_donations(user_id,status);
create index if not exists idx_email_queue_status on public.email_queue(status,scheduled_for);
create index if not exists idx_audit_created on public.admin_audit_logs(created_at desc,entity_type);
create index if not exists idx_status_history_app on public.application_status_history(application_type,application_id,created_at desc);

-- RLS
alter table public.recurring_donations enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.email_queue enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.application_status_history enable row level security;
alter table public.site_settings enable row level security;

-- User preference policy
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
create policy "Users manage own notification preferences" on public.notification_preferences
for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Users can read their own recurring donations
DROP POLICY IF EXISTS "Users read own recurring donations" ON public.recurring_donations;
create policy "Users read own recurring donations" on public.recurring_donations
for select to authenticated using (user_id = auth.uid());

-- Public settings are readable; sensitive settings remain service-only
DROP POLICY IF EXISTS "Public settings are readable" ON public.site_settings;
create policy "Public settings are readable" on public.site_settings
for select to anon,authenticated using (is_public = true);

-- Service role bypasses RLS for administrative tables.
