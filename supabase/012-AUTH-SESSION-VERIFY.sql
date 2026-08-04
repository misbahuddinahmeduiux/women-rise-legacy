select column_name,data_type,column_default,is_nullable
from information_schema.columns
where table_schema='public'
  and table_name='profiles'
  and column_name='auth_version';

select grantee,privilege_type,column_name
from information_schema.column_privileges
where table_schema='public'
  and table_name='profiles'
  and column_name='auth_version'
  and grantee in ('anon','authenticated');
