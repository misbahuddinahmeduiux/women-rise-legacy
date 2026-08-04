begin;

alter table public.profiles
  add column if not exists auth_version integer not null default 1;

alter table public.profiles
  drop constraint if exists profiles_auth_version_positive;

alter table public.profiles
  add constraint profiles_auth_version_positive
  check (auth_version > 0);

comment on column public.profiles.auth_version is
  'Server-managed version used to invalidate previously issued app sessions after account, staff role or permission changes.';

revoke update (auth_version) on table public.profiles from anon, authenticated;

commit;
