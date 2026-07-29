-- WOMEN RISE LEGACY — PHASE 5 UI & CMS UPGRADE
-- Safe to run after Phase 4. No destructive schema changes.

-- Correct the default homepage hero image path if the Phase 4 seed used a non-existent file.
update public.website_content
set value = jsonb_set(value, '{slides,0,image}', to_jsonb('/assets/brand/hero-network.webp'::text), true),
    updated_at = now()
where content_key = 'homepage.hero'
  and value #>> '{slides,0,image}' = '/assets/brand/hero-community.webp';

-- Ensure the Podcast feature can be controlled from the visual settings screen.
update public.site_settings
set value = jsonb_set(coalesce(value,'{}'::jsonb), '{podcast}', 'true'::jsonb, true),
    updated_at = now()
where key = 'features';

-- Add a harmless UI-version marker for support diagnostics.
insert into public.site_settings(key,value,description,is_public)
values ('ui', '{"version":"5.0.0","visualAdminForms":true,"responsiveHeader":true}'::jsonb, 'User interface version and visual-admin capabilities', false)
on conflict(key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();
