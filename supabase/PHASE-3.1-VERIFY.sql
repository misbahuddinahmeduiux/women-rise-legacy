select provider,display_name,mode,is_enabled,is_connected,last_tested_at,last_error
from public.payment_gateway_configs
order by provider;

select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('payment_gateway_configs','payment_gateway_events')
order by table_name;
