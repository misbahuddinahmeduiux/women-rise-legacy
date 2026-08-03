-- Women Rise Legacy — Security, staff permissions, mentor lifecycle and matching fixes
-- Apply only after a verified database backup. This migration is staged and preserves auth user IDs.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Account directory and safe profile security
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email_normalized text;
alter table public.profiles add column if not exists account_status text not null default 'active';

do $$ begin
  alter table public.profiles add constraint profiles_account_status_check
    check (account_status in ('active','suspended','deactivated'));
exception when duplicate_object then null; end $$;

update public.profiles p
set email_normalized = lower(u.email)
from auth.users u
where u.id = p.id and p.email_normalized is distinct from lower(u.email);

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email_normalized)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), lower(new.email))
  on conflict (id) do update set email_normalized = excluded.email_normalized;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_trigger on auth.users;
create trigger sync_profile_email_trigger
after insert or update of email on auth.users
for each row execute procedure public.sync_profile_email();

create index if not exists idx_profiles_email_normalized on public.profiles(email_normalized);
create index if not exists idx_profiles_member_search on public.profiles(lower(full_name), lower(city), lower(country));

-- Direct authenticated updates are restricted to safe personal columns.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users update own safe profile" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

revoke update on public.profiles from authenticated;
grant update (
  full_name, phone, country, city, avatar_url, headline, bio, skills,
  linkedin_url, website_url, business_name, timezone, languages
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Staff roles and permissions
-- ---------------------------------------------------------------------------
create table if not exists public.staff_roles (
  key text primary key,
  name text not null,
  description text,
  permissions text[] not null default '{}',
  is_super_admin boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.staff_roles(key,name,description,permissions,is_super_admin) values
('super_admin','Super Admin','Full platform authority.',array['*'],true),
('admin','Administrator','Broad operational authority without implicit super-admin escalation.',array[
  'view_overview','view_members','manage_members','manage_memberships','view_mentors','manage_mentors','approve_mentors',
  'manage_invitations','view_mentorship_requests','view_applications','manage_applications','manage_matches','manage_sessions','manage_donations','manage_submissions','manage_content','manage_email_queue',
  'view_reports','manage_staff','assign_roles','assign_permissions','manage_settings','manage_payments','view_audit'
],false),
('mentor_manager','Mentor Manager','Mentor onboarding, approvals, matching and sessions.',array[
  'view_overview','view_members','view_mentors','manage_mentors','approve_mentors','manage_invitations',
  'view_mentorship_requests','view_applications','manage_applications','manage_matches','manage_sessions'
],false),
('content_manager','Content Manager','Website and publishing access only.',array['view_overview','manage_content'],false),
('donation_manager','Donation Manager','Donation operations and receipts only.',array['view_overview','manage_donations','view_reports'],false),
('support_staff','Support Staff','Read-only member and mentor support.',array['view_overview','view_members','view_mentors','view_mentorship_requests'],false)
on conflict (key) do update set
  name=excluded.name,
  description=excluded.description,
  permissions=excluded.permissions,
  is_super_admin=excluded.is_super_admin,
  is_active=true,
  updated_at=now();

create table if not exists public.staff_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_key text not null references public.staff_roles(key),
  custom_permissions text[] not null default '{}',
  status text not null default 'invited' check (status in ('invited','active','suspended','deactivated')),
  job_title text,
  department text,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  activated_at timestamptz,
  accepted_at timestamptz,
  suspended_at timestamptz,
  deactivated_at timestamptz,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_memberships_role_status on public.staff_memberships(role_key,status);

-- Backfill genuine legacy staff without turning mentors into employees.
insert into public.staff_memberships(user_id,role_key,status,activated_at,created_at,updated_at)
select id,
       case role when 'admin' then 'super_admin'
                 when 'content_manager' then 'content_manager'
                 when 'donation_manager' then 'donation_manager'
       end,
       'active', now(), now(), now()
from public.profiles
where role in ('admin','content_manager','donation_manager')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Mentor profiles and invitation lifecycle
-- ---------------------------------------------------------------------------
create table if not exists public.mentor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  professional_title text,
  biography text,
  expertise text[] not null default '{}',
  mentor_skills text[] not null default '{}',
  industry text,
  years_experience integer check (years_experience is null or years_experience between 0 and 80),
  languages text[] not null default '{}',
  availability text,
  timezone text,
  maximum_mentees integer not null default 3 check (maximum_mentees between 1 and 100),
  session_format text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  profile_status text not null default 'profile_incomplete' check (profile_status in ('invited','profile_incomplete','pending_approval','approved','rejected','suspended','deactivated')),
  consent_accepted_at timestamptz,
  profile_completed_at timestamptz,
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  directory_visible boolean not null default false,
  is_active boolean not null default false,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mentor_profiles_public on public.mentor_profiles(profile_status,is_active,directory_visible);
create index if not exists idx_mentor_profiles_expertise on public.mentor_profiles using gin(expertise);

create table if not exists public.mentor_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  user_id uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'invited' check (status in ('draft','invited','accepted','profile_incomplete','pending_approval','approved','rejected','expired','revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_sent_at timestamptz not null default now(),
  resend_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_one_active_mentor_invitation_email
on public.mentor_invitations(email_normalized)
where status in ('invited','accepted','profile_incomplete','pending_approval');
create index if not exists idx_mentor_invitations_status_expiry on public.mentor_invitations(status,expires_at);

create table if not exists public.security_migration_review (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  issue text not null,
  snapshot jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Preserve legacy mentor information but require review before public exposure.
insert into public.mentor_profiles(
  user_id, professional_title, biography, expertise, mentor_skills, years_experience,
  languages, availability, timezone, session_format, profile_status,
  directory_visible, is_active, created_at, updated_at
)
select p.id, p.mentor_title, p.bio, coalesce(p.mentor_expertise,'{}'), coalesce(p.skills,'{}'),
       p.mentor_years_experience, coalesce(p.languages,'{}'), p.mentor_availability,
       p.timezone, p.mentor_session_type,
       'pending_approval', false, false, now(), now()
from public.profiles p
where coalesce(p.is_mentor,false) = true or p.role = 'mentor'
on conflict (user_id) do nothing;

insert into public.security_migration_review(entity_type,entity_id,issue,snapshot)
select 'mentor_profile', p.id::text,
       'Legacy mentor requires approval review before directory publication.',
       jsonb_build_object('legacy_role',p.role,'legacy_is_mentor',p.is_mentor,'legacy_directory_visible',p.is_directory_visible)
from public.profiles p
where (coalesce(p.is_mentor,false) = true or p.role = 'mentor')
  and not exists (
    select 1 from public.security_migration_review r
    where r.entity_type='mentor_profile' and r.entity_id=p.id::text and r.resolved_at is null
  );

-- A mentor is a member with a mentor profile, never an implicit staff role.
update public.profiles set role='member' where role='mentor';
update public.profiles set is_mentor=false, mentor_featured=false where is_mentor=true;

-- ---------------------------------------------------------------------------
-- Matching and session lifecycle
-- ---------------------------------------------------------------------------
alter table public.mentorship_matches add column if not exists proposed_at timestamptz;
alter table public.mentorship_matches add column if not exists mentor_notified_at timestamptz;
alter table public.mentorship_matches add column if not exists mentor_accepted_at timestamptz;
alter table public.mentorship_matches add column if not exists mentor_declined_at timestamptz;
alter table public.mentorship_matches add column if not exists activated_at timestamptz;
alter table public.mentorship_matches add column if not exists closed_at timestamptz;

update public.mentorship_matches set proposed_at=coalesce(proposed_at,created_at);
update public.mentorship_matches set activated_at=coalesce(activated_at,starts_at) where status='active';
update public.mentorship_matches set mentor_accepted_at=coalesce(mentor_accepted_at,starts_at) where status='active';
update public.mentorship_matches set mentor_declined_at=coalesce(mentor_declined_at,ended_at) where status='declined';
update public.mentorship_matches set closed_at=coalesce(closed_at,ended_at) where status in ('completed','declined','cancelled');

create or replace function public.validate_mentor_session_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.mentorship_matches%rowtype;
  mp public.mentor_profiles%rowtype;
  member_status text;
  mentor_account_status text;
begin
  select * into m from public.mentorship_matches where id = new.match_id;
  if not found or m.status <> 'active' or m.mentor_accepted_at is null then
    raise exception 'Sessions require an active mentor-accepted match.';
  end if;

  select * into mp from public.mentor_profiles where user_id = m.mentor_id;
  if not found or mp.profile_status <> 'approved' or not mp.is_active then
    raise exception 'Sessions require an approved active mentor.';
  end if;

  select account_status into member_status from public.profiles where id=m.member_id;
  select account_status into mentor_account_status from public.profiles where id=m.mentor_id;
  if member_status <> 'active' or mentor_account_status <> 'active' then
    raise exception 'Sessions require active participant accounts.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_mentor_session_eligibility_trigger on public.mentor_sessions;
create trigger validate_mentor_session_eligibility_trigger
before insert or update of match_id on public.mentor_sessions
for each row execute procedure public.validate_mentor_session_eligibility();

-- ---------------------------------------------------------------------------
-- RLS and grants for new sensitive tables
-- ---------------------------------------------------------------------------
alter table public.staff_roles enable row level security;
alter table public.staff_memberships enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentor_invitations enable row level security;
alter table public.security_migration_review enable row level security;

drop policy if exists "Staff read own membership" on public.staff_memberships;
create policy "Staff read own membership" on public.staff_memberships
for select to authenticated using (user_id=auth.uid());

drop policy if exists "Authenticated read active staff roles" on public.staff_roles;
create policy "Authenticated read active staff roles" on public.staff_roles
for select to authenticated using (is_active=true);

drop policy if exists "Mentors read own mentor profile" on public.mentor_profiles;
create policy "Mentors read own mentor profile" on public.mentor_profiles
for select to authenticated using (user_id=auth.uid());

-- No direct authenticated update/insert grants on mentor, staff, invitation, audit or migration-review tables.
revoke insert, update, delete on public.staff_roles, public.staff_memberships, public.mentor_profiles,
  public.mentor_invitations, public.security_migration_review, public.admin_audit_logs from authenticated, anon;
grant select on public.staff_roles to authenticated;
grant select on public.staff_memberships, public.mentor_profiles to authenticated;

-- Keep updated_at reliable.
do $$ declare t text; begin
  foreach t in array array['staff_roles','staff_memberships','mentor_profiles','mentor_invitations'] loop
    execute format('drop trigger if exists set_%s_updated_at on public.%I',t,t);
    execute format('create trigger set_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()',t,t);
  end loop;
end $$;

commit;
