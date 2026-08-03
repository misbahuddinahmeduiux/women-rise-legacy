-- Women Rise Legacy — permanent single Super Admin and exact module permissions
-- Apply once after 009_security_roles_mentors.sql and 010_profiles_privilege_hardening.sql.
-- This migration is additive and does not alter member, mentor or membership-plan data.

begin;

alter table public.staff_memberships
  add column if not exists permission_mode text not null default 'additive';

-- Add the constraint safely when it is not already present.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.staff_memberships'::regclass
      and conname = 'staff_memberships_permission_mode_check'
  ) then
    alter table public.staff_memberships
      add constraint staff_memberships_permission_mode_check
      check (permission_mode in ('additive','replace'));
  end if;
end $$;

comment on column public.staff_memberships.permission_mode is
  'additive = role permissions plus custom permissions; replace = exact custom permission list. Super Admin always retains full authority.';

-- Stop safely unless legacy data contains exactly one active Super Admin.
-- No account is selected or changed automatically by this migration.
do $$
declare
  super_admin_count integer;
  active_super_admin_count integer;
begin
  select count(*) into super_admin_count
  from public.staff_memberships
  where role_key = 'super_admin';

  select count(*) into active_super_admin_count
  from public.staff_memberships
  where role_key = 'super_admin' and status = 'active';

  if super_admin_count <> 1 or active_super_admin_count <> 1 then
    raise exception 'Single Super Admin rule requires exactly one active Super Admin. Found % total and % active. Review staff_memberships manually first.', super_admin_count, active_super_admin_count;
  end if;
end $$;

-- At most one staff record may carry the permanent Super Admin role.
create unique index if not exists idx_staff_memberships_single_super_admin
  on public.staff_memberships (role_key)
  where role_key = 'super_admin';

-- Database-level protection prevents deleting, replacing, suspending or editing
-- the permanent Super Admin even if an unsafe future route bypasses the UI.
create or replace function public.protect_permanent_super_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role_key = 'super_admin' then
    if tg_op = 'DELETE' then
      raise exception 'The permanent Super Admin staff record cannot be deleted.';
    end if;

    if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
      raise exception 'The permanent Super Admin staff record cannot be edited, suspended, deactivated or replaced.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_permanent_super_admin_trigger on public.staff_memberships;
create trigger protect_permanent_super_admin_trigger
before update or delete on public.staff_memberships
for each row execute function public.protect_permanent_super_admin();

commit;
