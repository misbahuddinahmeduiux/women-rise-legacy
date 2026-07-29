-- WOMEN RISE LEGACY — PHASE 3 VERIFICATION
select 'donations_receipts' as check_name, count(*) as count from public.donations where receipt_token is not null
union all select 'recurring_donations', count(*) from public.recurring_donations
union all select 'notification_preferences', count(*) from public.notification_preferences
union all select 'email_queue', count(*) from public.email_queue
union all select 'admin_audit_logs', count(*) from public.admin_audit_logs
union all select 'application_status_history', count(*) from public.application_status_history
union all select 'site_settings', count(*) from public.site_settings;

select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='donations'
  and column_name in ('user_id','receipt_number','receipt_token','donor_message','is_anonymous','receipt_sent_at','provider_payload')
order by column_name;
