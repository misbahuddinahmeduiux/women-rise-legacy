-- WOMEN RISE LEGACY — PHASE 2 VERIFICATION
-- Run after PHASE-2-SETUP-ALL.sql. This file does not change data.

select
  to_regclass('public.membership_applications') is not null as membership_applications_ready,
  to_regclass('public.mentor_requests') is not null as mentor_requests_ready,
  to_regclass('public.businesses') is not null as businesses_ready,
  to_regclass('public.products_services') is not null as products_services_ready,
  to_regclass('public.opportunities') is not null as opportunities_ready,
  to_regclass('public.resources') is not null as resources_ready,
  to_regclass('public.chapters') is not null as chapters_ready,
  to_regclass('public.network_events') is not null as network_events_ready,
  to_regclass('public.event_registrations') is not null as event_registrations_ready,
  to_regclass('public.member_success_stories') is not null as member_success_stories_ready;

select
  count(*) filter (where membership_status='active') as active_members,
  count(*) filter (where is_directory_visible=true) as directory_members,
  count(*) filter (where is_mentor=true) as approved_mentors,
  count(*) filter (where role='admin') as administrators
from public.profiles;

select 'businesses' as module, count(*) as published_records from public.businesses where is_published=true
union all select 'products_services', count(*) from public.products_services where is_published=true
union all select 'opportunities', count(*) from public.opportunities where is_published=true
union all select 'resources', count(*) from public.resources where is_published=true
union all select 'chapters', count(*) from public.chapters where is_published=true
union all select 'network_events', count(*) from public.network_events where is_published=true
union all select 'member_success_stories', count(*) from public.member_success_stories where is_published=true
order by module;
