-- Read-only verification for migration 011.
-- Safe to run after 011_single_super_admin_and_permission_overrides.sql.

select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'staff_memberships'
  and column_name = 'permission_mode';

select
  count(*) filter (where role_key = 'super_admin') as total_super_admins,
  count(*) filter (where role_key = 'super_admin' and status = 'active') as active_super_admins
from public.staff_memberships;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'staff_memberships'
  and indexname = 'idx_staff_memberships_single_super_admin';

select trigger_name, event_manipulation, action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'staff_memberships'
  and trigger_name = 'protect_permanent_super_admin_trigger'
order by event_manipulation;

select permission_mode, count(*) as records
from public.staff_memberships
group by permission_mode
order by permission_mode;
