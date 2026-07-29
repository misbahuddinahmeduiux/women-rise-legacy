-- WOMEN RISE LEGACY — PHASE 4 VERIFY
-- Read-only checks. This file does not create, update, or delete data.

select 'membership_plans' as object, count(*) as rows from public.membership_plans
union all select 'membership_payments', count(*) from public.membership_payments
union all select 'membership_subscriptions', count(*) from public.membership_subscriptions
union all select 'membership_provider_prices', count(*) from public.membership_provider_prices
union all select 'mentorship_matches', count(*) from public.mentorship_matches
union all select 'mentor_sessions', count(*) from public.mentor_sessions
union all select 'podcast_categories', count(*) from public.podcast_categories
union all select 'podcast_guests', count(*) from public.podcast_guests
union all select 'podcast_episodes', count(*) from public.podcast_episodes
union all select 'website_content', count(*) from public.website_content
union all select 'content_options', count(*) from public.content_options
union all select 'media_assets', count(*) from public.media_assets
union all select 'email_templates', count(*) from public.email_templates
order by object;

-- Expected seeded plans: Rise, Legacy and Elite. Prices remain editable by admin.
select name,slug,access_level,currency,
       monthly_enabled,monthly_price,
       yearly_enabled,yearly_price,
       one_time_enabled,one_time_price,one_time_lifetime,
       mentorship_access,is_active
from public.membership_plans
order by display_order;

-- Required CMS records used by the public React pages.
with required(content_key) as (
  values
    ('homepage.hero'),('homepage.founder'),('homepage.cta'),('homepage.sections'),
    ('page.about'),('page.programs'),('page.get-involved'),('page.membership'),
    ('page.membership-apply'),('page.members'),('page.mentors'),('page.mentor-request'),
    ('page.businesses'),('page.products-services'),('page.opportunities'),('page.resources'),
    ('page.events'),('page.chapters'),('page.success-stories'),('page.podcast'),
    ('page.current-needs'),('page.campaigns'),('page.sponsor-families'),('page.impact'),
    ('page.donate'),('page.donate-items'),('page.request-assistance'),('page.volunteer'),
    ('page.partners'),('page.contact'),('page.shipment-tracking'),
    ('site.navigation'),('site.footer'),('site.general'),('site.seo'),('site.announcement')
)
select required.content_key,
       case when website_content.content_key is null then 'MISSING' else 'OK' end as status,
       coalesce(website_content.is_published,false) as is_published
from required
left join public.website_content using(content_key)
order by required.content_key;

-- Template keys required by membership and mentor lifecycle flows.
with required(template_key) as (
  values
    ('membership_trial_started'),('membership_activated'),('membership_renewed'),
    ('membership_payment_failed'),('membership_cancelled'),
    ('mentor_invitation'),('mentor_match')
)
select required.template_key,
       case when email_templates.template_key is null then 'MISSING' else 'OK' end as status,
       coalesce(email_templates.is_active,false) as is_active
from required
left join public.email_templates using(template_key)
order by required.template_key;

-- Storage bucket used by Admin > Media Library.
select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id='wrl-media';

-- Confirm RLS is enabled on Phase 4 tables.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in (
    'membership_plans','membership_payments','membership_subscriptions','membership_provider_prices',
    'mentorship_matches','mentor_sessions','podcast_categories','podcast_guests','podcast_episodes',
    'website_content','content_options','media_assets','email_templates'
  )
order by c.relname;
