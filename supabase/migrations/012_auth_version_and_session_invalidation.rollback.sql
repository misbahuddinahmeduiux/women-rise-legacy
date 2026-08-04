-- EMERGENCY ROLLBACK ONLY.
-- Deploy code that no longer reads profiles.auth_version before running this file.
begin;

alter table public.profiles
  drop constraint if exists profiles_auth_version_positive;

alter table public.profiles
  drop column if exists auth_version;

commit;
