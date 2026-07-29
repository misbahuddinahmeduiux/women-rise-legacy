-- WOMEN RISE LEGACY — PHASE 6 / STEP 1
-- Homepage client imagery + professional closing CTA support.
-- Safe update: client imagery replaces only known Phase 4/5 default image paths.

update public.website_content
set value = jsonb_build_object(
  'slides',
  jsonb_build_array(
    jsonb_build_object(
      'eyebrow','Founder-led global movement',
      'title','Where women rise together, legacies begin.',
      'text','Women Rise Legacy connects women with mentorship, leadership opportunities, business visibility, community, and practical support—all inside one trusted ecosystem.',
      'primaryLabel','Join the network',
      'primaryTo','/membership',
      'secondaryLabel','Meet the founder',
      'secondaryTo','/about',
      'image','/assets/client/women-rise-founder-speaking-black.webp',
      'imageAlt','Women Rise Legacy founder speaking at a leadership event',
      'imageMode','cover',
      'badgeTitle','Founder-led vision',
      'badgeText','Leadership rooted in lived experience',
      'theme','founder-theme'
    ),
    jsonb_build_object(
      'eyebrow','Network. Mentorship. Visibility.',
      'title','Build the relationships that move your vision forward.',
      'text','Find mentors, trusted peers, women-owned businesses, events, and opportunities designed to help members grow with clarity and confidence.',
      'primaryLabel','Explore the network',
      'primaryTo','/members',
      'secondaryLabel','Find a mentor',
      'secondaryTo','/mentors',
      'image','/assets/client/women-rise-conference-group.webp',
      'imageAlt','Women Rise Legacy members together at the conference',
      'imageMode','cover',
      'badgeTitle','Global sisterhood',
      'badgeText','Connection that creates opportunity',
      'theme','network-theme'
    ),
    jsonb_build_object(
      'eyebrow','Humanitarian action with dignity',
      'title','Turn generosity into verified, visible impact.',
      'text','Support current needs, family sponsorships, education, disaster response, and women-led community initiatives with transparent progress.',
      'primaryLabel','Make a donation',
      'primaryTo','/donate',
      'secondaryLabel','Explore current needs',
      'secondaryTo','/current-needs',
      'image','/assets/client/women-rise-community-dinner.webp',
      'imageAlt','Women Rise Legacy members connecting at a community event',
      'imageMode','cover',
      'badgeTitle','Dignity-first support',
      'badgeText','Verified needs and transparent impact',
      'theme','impact-theme'
    )
  )
),
updated_at = now()
where content_key = 'homepage.hero'
  and coalesce(value #>> '{slides,0,image}','') in (
    '/assets/brand/hero-network.webp',
    '/assets/brand/hero-community.webp',
    '/assets/brand/founder-transparent.png'
  );

update public.website_content
set value = jsonb_set(
      jsonb_set(
        coalesce(value,'{}'::jsonb),
        '{image}',
        to_jsonb('/assets/client/women-rise-founder-portrait.webp'::text),
        true
      ),
      '{imageAlt}',
      to_jsonb('Founder of Women Rise Legacy Network'::text),
      true
    ),
    updated_at = now()
where content_key = 'homepage.founder'
  and coalesce(value ->> 'image','') in (
    '/assets/brand/founder-transparent.png',
    '/assets/brand/founder.webp',
    '/assets/brand/event-founder.webp'
  );

update public.website_content
set value = jsonb_set(
      coalesce(value,'{}'::jsonb),
      '{images}',
      jsonb_build_array(
        jsonb_build_object(
          'url','/assets/client/women-rise-founder-brand-backdrop.webp',
          'alt','Women Rise Legacy founder beside the official brand backdrop'
        ),
        jsonb_build_object(
          'url','/assets/client/women-rise-founder-speaking-beige.webp',
          'alt','Women Rise Legacy founder speaking on stage'
        ),
        jsonb_build_object(
          'url','/assets/client/women-rise-conference-group.webp',
          'alt','Women Rise Legacy members at the conference'
        )
      ),
      true
    ),
    updated_at = now()
where content_key = 'homepage.gallery'
  and coalesce(value #>> '{images,0,url}','') in (
    '/assets/brand/event-community.webp',
    '/assets/brand/event-panel.webp',
    '/assets/brand/event-keynote.webp'
  );

insert into public.site_settings(key,value,description,is_public)
values (
  'ui',
  '{"version":"6.0.0-step-1","visualAdminForms":true,"responsiveHeader":true,"professionalHomepageCta":true,"clientHomepageImages":true}'::jsonb,
  'User interface version and visual capabilities',
  false
)
on conflict(key) do update
set value = coalesce(public.site_settings.value,'{}'::jsonb) || excluded.value,
    description = excluded.description,
    updated_at = now();
