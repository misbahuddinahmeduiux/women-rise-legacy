-- Women Rise Legacy Foundation — Phase 1 Supabase schema
-- Run this file in Supabase SQL Editor on a new project.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'member' check (role in ('member','volunteer','partner_representative','donation_manager','content_manager','admin')),
  phone text,
  country text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if old.role is distinct from new.role
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Profile role changes require administrator service access.';
  end if;
  return new;
end; $$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger before update on public.profiles for each row execute procedure public.protect_profile_role();

create table if not exists public.current_needs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  category text not null,
  description text not null,
  country text not null,
  community text not null,
  quantity_needed integer not null check (quantity_needed > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  urgency text not null default 'normal' check (urgency in ('urgent','high','normal')),
  deadline date,
  partner_organization text,
  image_url text,
  wishlist_url text,
  donation_instructions text,
  status text not null default 'open' check (status in ('open','partially_fulfilled','fulfilled','shipped','delivered','closed')),
  is_published boolean not null default true,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  campaign_type text not null,
  country text not null,
  summary text not null,
  description text not null,
  funding_goal numeric(12,2) not null check (funding_goal > 0),
  amount_raised numeric(12,2) not null default 0 check (amount_raised >= 0),
  items_needed text,
  start_date date,
  end_date date,
  image_url text,
  status text not null default 'active' check (status in ('draft','active','completed','closed')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sponsor_families (
  id uuid primary key default gen_random_uuid(),
  public_alias text not null,
  slug text unique not null,
  family_reference_id text unique not null,
  country text not null,
  general_location text not null,
  family_size integer not null check (family_size > 0),
  situation_summary text not null,
  assistance_required text not null,
  sponsorship_goal numeric(12,2) not null check (sponsorship_goal > 0),
  amount_raised numeric(12,2) not null default 0 check (amount_raised >= 0),
  monthly_support_amount numeric(12,2) not null check (monthly_support_amount > 0),
  image_url text,
  status text not null default 'open' check (status in ('open','sponsored','completed','closed')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donor_name text not null,
  donor_email text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'usd',
  frequency text not null default 'one_time' check (frequency in ('one_time','monthly')),
  designation text not null default 'General Donation',
  campaign_id uuid references public.campaigns(id) on delete set null,
  sponsor_family_id uuid references public.sponsor_families(id) on delete set null,
  payment_provider text not null default 'stripe',
  payment_session_id text unique,
  payment_intent_id text,
  subscription_id text,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text, subject text not null, message text not null,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.item_donations (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text, item_category text not null, item_description text not null, quantity integer not null check(quantity>0), item_condition text not null, city text not null, country text not null, shipping_preference text not null,
  tracking_number text, status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.shipment_tracking (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  item_donation_id uuid references public.item_donations(id) on delete set null,
  current_need_id uuid references public.current_needs(id) on delete set null,
  carrier text not null,
  tracking_number text not null,
  shipped_date date not null,
  notes text,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.assistance_requests (
  id uuid primary key default gen_random_uuid(), full_name text not null, public_alias text not null, email text not null, phone text, country text not null, general_location text not null, family_size integer not null check(family_size>0), assistance_type text not null, situation_summary text not null, consent_confirmed boolean not null default false,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  private_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.volunteer_applications (
  id uuid primary key default gen_random_uuid(), full_name text not null, email text not null, phone text, country text not null, city text not null, skills text not null, availability text not null, motivation text not null,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(), contact_name text not null, email text not null, phone text, organization_name text not null, organization_type text not null, country text not null, website text, partnership_interest text not null,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.impact_stories (
  id uuid primary key default gen_random_uuid(), title text not null, country text not null, community text not null, campaign_id uuid references public.campaigns(id) on delete set null, story text not null, beneficiaries_count integer not null default 0, items_distributed integer not null default 0, image_url text, video_url text, consent_confirmed boolean not null default false, publish_date date not null default current_date, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(title, publish_date)
);
create table if not exists public.impact_reports (
  id uuid primary key default gen_random_uuid(),
  report_title text not null,
  reporting_period text not null,
  year integer not null check (year between 2000 and 2100),
  country text not null,
  program text not null,
  people_supported integer not null default 0 check (people_supported >= 0),
  items_distributed integer not null default 0 check (items_distributed >= 0),
  funds_used numeric(12,2) not null default 0 check (funds_used >= 0),
  pdf_url text,
  image_url text,
  summary text not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(report_title, year)
);
create table if not exists public.countries_served (
  id uuid primary key default gen_random_uuid(), country text unique not null, latitude numeric(9,6), longitude numeric(9,6), communities_count integer not null default 0, description text, is_active boolean not null default true, created_at timestamptz not null default now()
);

create index if not exists idx_current_needs_public on public.current_needs(is_published,status,country,category);
create index if not exists idx_campaigns_public on public.campaigns(is_published,status);
create index if not exists idx_families_public on public.sponsor_families(is_published,status);
create index if not exists idx_donations_email on public.donations(donor_email);
create index if not exists idx_submissions_status on public.assistance_requests(status);
create index if not exists idx_shipments_tracking on public.shipment_tracking(tracking_number,status);
create index if not exists idx_impact_reports_public on public.impact_reports(is_published,year);

create trigger set_profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger set_current_needs_updated_at before update on public.current_needs for each row execute procedure public.set_updated_at();
create trigger set_campaigns_updated_at before update on public.campaigns for each row execute procedure public.set_updated_at();
create trigger set_sponsor_families_updated_at before update on public.sponsor_families for each row execute procedure public.set_updated_at();
create trigger set_donations_updated_at before update on public.donations for each row execute procedure public.set_updated_at();
create trigger set_contact_updated_at before update on public.contact_messages for each row execute procedure public.set_updated_at();
create trigger set_items_updated_at before update on public.item_donations for each row execute procedure public.set_updated_at();
create trigger set_shipments_updated_at before update on public.shipment_tracking for each row execute procedure public.set_updated_at();
create trigger set_assistance_updated_at before update on public.assistance_requests for each row execute procedure public.set_updated_at();
create trigger set_volunteers_updated_at before update on public.volunteer_applications for each row execute procedure public.set_updated_at();
create trigger set_partners_updated_at before update on public.partner_applications for each row execute procedure public.set_updated_at();
create trigger set_impact_updated_at before update on public.impact_stories for each row execute procedure public.set_updated_at();
create trigger set_impact_reports_updated_at before update on public.impact_reports for each row execute procedure public.set_updated_at();

create or replace function public.recalculate_donation_totals()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  affected_campaign uuid;
  affected_family uuid;
begin
  affected_campaign := new.campaign_id;
  affected_family := new.sponsor_family_id;

  if TG_OP = 'UPDATE' then
    if old.campaign_id is distinct from new.campaign_id and old.campaign_id is not null then
      update campaigns set amount_raised = coalesce((select sum(amount) from donations where campaign_id=old.campaign_id and payment_status='paid'),0) where id=old.campaign_id;
    end if;
    if old.sponsor_family_id is distinct from new.sponsor_family_id and old.sponsor_family_id is not null then
      update sponsor_families set amount_raised = coalesce((select sum(amount) from donations where sponsor_family_id=old.sponsor_family_id and payment_status='paid'),0) where id=old.sponsor_family_id;
    end if;
  end if;

  if affected_campaign is not null then
    update campaigns set amount_raised = coalesce((select sum(amount) from donations where campaign_id=affected_campaign and payment_status='paid'),0) where id=affected_campaign;
  end if;
  if affected_family is not null then
    update sponsor_families set amount_raised = coalesce((select sum(amount) from donations where sponsor_family_id=affected_family and payment_status='paid'),0) where id=affected_family;
  end if;
  return new;
end; $$;
drop trigger if exists donation_totals_trigger on public.donations;
create trigger donation_totals_trigger after insert or update on public.donations for each row execute procedure public.recalculate_donation_totals();

alter table public.profiles enable row level security;
alter table public.current_needs enable row level security;
alter table public.campaigns enable row level security;
alter table public.sponsor_families enable row level security;
alter table public.donations enable row level security;
alter table public.contact_messages enable row level security;
alter table public.item_donations enable row level security;
alter table public.shipment_tracking enable row level security;
alter table public.assistance_requests enable row level security;
alter table public.volunteer_applications enable row level security;
alter table public.partner_applications enable row level security;
alter table public.impact_stories enable row level security;
alter table public.impact_reports enable row level security;
alter table public.countries_served enable row level security;

create policy "Users can view own profile" on public.profiles for select to authenticated using (auth.uid()=id);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
create policy "Published needs are public" on public.current_needs for select to anon,authenticated using (is_published=true);
create policy "Published campaigns are public" on public.campaigns for select to anon,authenticated using (is_published=true);
create policy "Published family profiles are public" on public.sponsor_families for select to anon,authenticated using (is_published=true);
create policy "Published impact stories are public" on public.impact_stories for select to anon,authenticated using (is_published=true);
create policy "Published impact reports are public" on public.impact_reports for select to anon,authenticated using (is_published=true);
create policy "Active countries are public" on public.countries_served for select to anon,authenticated using (is_active=true);
create policy "Donors can view own donations" on public.donations for select to authenticated using (lower(donor_email)=lower(coalesce(auth.jwt()->>'email','')));

grant usage on schema public to anon, authenticated;
grant select on public.current_needs, public.campaigns, public.sponsor_families, public.impact_stories, public.impact_reports, public.countries_served to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.donations to authenticated;

-- Storage buckets. Public media can be displayed publicly; private documents are backend-only.
insert into storage.buckets (id,name,public) values ('public-media','public-media',true) on conflict (id) do nothing;
insert into storage.buckets (id,name,public) values ('private-documents','private-documents',false) on conflict (id) do nothing;
create policy "Public media is readable" on storage.objects for select to anon,authenticated using (bucket_id='public-media');

-- Service role bypasses RLS. No public write policies are intentionally created for sensitive forms or admin content.
