-- Run after migration 009. Any failed requirement raises an exception.
do $$
declare unsafe_count integer; safe_grant boolean;
begin
  if to_regclass('public.staff_memberships') is null or to_regclass('public.mentor_profiles') is null or to_regclass('public.mentor_invitations') is null then
    raise exception 'Required security tables are missing.';
  end if;

  if has_table_privilege('authenticated','public.profiles','UPDATE') then
    raise exception 'Authenticated still has broad table-level UPDATE on profiles.';
  end if;

  if has_column_privilege('authenticated','public.profiles','role','UPDATE')
     or has_column_privilege('authenticated','public.profiles','is_mentor','UPDATE')
     or has_column_privilege('authenticated','public.profiles','membership_status','UPDATE')
     or has_column_privilege('authenticated','public.profiles','membership_level','UPDATE') then
    raise exception 'Authenticated can still update a protected profile column.';
  end if;

  safe_grant := has_column_privilege('authenticated','public.profiles','full_name','UPDATE');
  if not safe_grant then raise exception 'Safe personal profile updates are not available.'; end if;

  select count(*) into unsafe_count from public.mentor_profiles
  where directory_visible=true and (profile_status<>'approved' or is_active=false);
  if unsafe_count>0 then raise exception '% unsafe mentor profiles are marked directory-visible.',unsafe_count; end if;

  select count(*) into unsafe_count from public.profiles where role='mentor' or coalesce(is_mentor,false)=true;
  if unsafe_count>0 then raise exception '% profiles still use legacy mentor identity flags.',unsafe_count; end if;

  if exists(select 1 from public.staff_roles where key in ('content_manager','donation_manager') and ('*'=any(permissions) or 'manage_staff'=any(permissions) or 'assign_roles'=any(permissions) or 'assign_permissions'=any(permissions))) then
    raise exception 'A limited staff role still contains elevated staff-management authority.';
  end if;

  if not exists(select 1 from pg_trigger where tgname='validate_mentor_session_eligibility_trigger' and not tgisinternal) then
    raise exception 'Session eligibility trigger is missing.';
  end if;
end $$;

select 'verification_status' as check_name,'PASSED' as result
union all select 'staff_roles',count(*)::text from public.staff_roles
union all select 'staff_memberships',count(*)::text from public.staff_memberships
union all select 'mentor_profiles',count(*)::text from public.mentor_profiles
union all select 'mentor_invitations',count(*)::text from public.mentor_invitations
union all select 'migration_review',count(*)::text from public.security_migration_review;

select policyname,tablename,cmd
from pg_policies
where schemaname='public' and tablename in ('profiles','staff_memberships','mentor_profiles','mentor_invitations','admin_audit_logs')
order by tablename,policyname;

select grantee,privilege_type,column_name
from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and grantee='authenticated'
order by privilege_type,column_name;
