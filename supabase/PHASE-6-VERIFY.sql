-- WOMEN RISE LEGACY — PHASE 6 / STEP 1 VERIFICATION
select
  'homepage.hero' as check_name,
  case
    when jsonb_array_length(value -> 'slides') >= 3
     and value #>> '{slides,0,image}' like '/assets/client/%'
    then 'OK' else 'CHECK' end as result
from public.website_content
where content_key='homepage.hero'
union all
select
  'homepage.founder',
  case when value ->> 'image' = '/assets/client/women-rise-founder-portrait.webp' then 'OK' else 'CHECK' end
from public.website_content
where content_key='homepage.founder'
union all
select
  'homepage.gallery',
  case when value #>> '{images,0,url}' like '/assets/client/%' then 'OK' else 'CHECK' end
from public.website_content
where content_key='homepage.gallery'
union all
select
  'ui',
  case when value ->> 'professionalHomepageCta' = 'true' then 'OK' else 'CHECK' end
from public.site_settings
where key='ui';
