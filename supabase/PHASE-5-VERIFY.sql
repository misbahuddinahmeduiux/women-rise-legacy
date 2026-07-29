-- WOMEN RISE LEGACY — PHASE 5 VERIFICATION
select content_key,
       value #>> '{slides,0,image}' as hero_image,
       case when value #>> '{slides,0,image}' = '/assets/brand/hero-network.webp' then 'OK' else 'CHECK' end as status
from public.website_content
where content_key='homepage.hero';

select key,
       value,
       case
         when key='features' and value ? 'podcast' then 'OK'
         when key='ui' and value->>'version'='5.0.0' then 'OK'
         else 'CHECK'
       end as status
from public.site_settings
where key in ('features','ui')
order by key;
