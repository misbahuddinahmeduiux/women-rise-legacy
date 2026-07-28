-- WOMEN RISE LEGACY — PHASE 2 NETWORK MIGRATION
-- Run once in the SAME Supabase project after Phase 1 is working.
-- Idempotent: safe to re-run during setup.

create extension if not exists pgcrypto;

-- Extend member profiles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','mentor','volunteer','partner_representative','chapter_leader','donation_manager','content_manager','admin'));
alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists skills text[] default '{}';
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists website_url text;
alter table public.profiles add column if not exists membership_level text check (membership_level in ('rise','legacy','elite'));
alter table public.profiles add column if not exists membership_status text not null default 'inactive' check (membership_status in ('inactive','pending','active','paused','expired'));
alter table public.profiles add column if not exists is_directory_visible boolean not null default false;
alter table public.profiles add column if not exists is_mentor boolean not null default false;
alter table public.profiles add column if not exists mentor_expertise text[] default '{}';
alter table public.profiles add column if not exists mentor_availability text;
alter table public.profiles add column if not exists business_name text;

create table if not exists public.membership_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  requested_level text not null check (requested_level in ('rise','legacy','elite')),
  "current_role" text not null,
  professional_goal text not null,
  community_interest text not null,
  consent_confirmed boolean not null default false,
  status text not null default 'new' check (status in ('new','under_review','approved','rejected','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete set null,
  mentor_id uuid references public.profiles(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  goals text not null,
  preferred_topics text not null,
  availability text not null,
  admin_notes text,
  status text not null default 'new' check (status in ('new','under_review','matched','approved','rejected','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text unique not null,
  owner_name text not null,
  description text not null,
  industry text not null,
  country text not null,
  city text not null,
  website_url text,
  email text,
  phone text,
  logo_url text,
  image_url text,
  virtual_services boolean not null default false,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  title text not null,
  slug text unique not null,
  item_type text not null check (item_type in ('product','service')),
  description text not null,
  price numeric(12,2),
  currency text not null default 'usd',
  image_url text,
  external_purchase_url text,
  contact_url text,
  category text not null,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  opportunity_type text not null,
  organization text not null,
  location text not null,
  work_mode text not null default 'onsite',
  deadline date,
  eligibility text not null,
  description text not null,
  application_url text,
  contact_email text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text not null,
  resource_type text not null,
  file_url text,
  external_url text,
  image_url text,
  membership_level text not null default 'all' check (membership_level in ('all','rise','legacy','elite')),
  download_instructions text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  city text not null,
  state text,
  country text not null,
  leader_name text not null,
  contact_email text,
  image_url text,
  meeting_schedule text,
  description text not null,
  status text not null default 'active' check (status in ('forming','active','paused','closed')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.network_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  event_type text not null,
  description text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  location text not null,
  is_virtual boolean not null default false,
  registration_url text,
  image_url text,
  capacity integer,
  status text not null default 'upcoming' check (status in ('draft','upcoming','live','completed','cancelled')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.network_events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'registered' check (status in ('registered','waitlisted','attended','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,email)
);

create table if not exists public.member_success_stories (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.profiles(id) on delete set null,
  title text not null,
  slug text unique not null,
  member_name text not null,
  achievement text not null,
  story text not null,
  image_url text,
  video_url text,
  publish_date date not null default current_date,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_profiles_directory on public.profiles(is_directory_visible,membership_status,is_mentor);
create index if not exists idx_businesses_public on public.businesses(is_published,is_featured,industry,country);
create index if not exists idx_products_public on public.products_services(is_published,is_featured,category);
create index if not exists idx_opportunities_public on public.opportunities(is_published,deadline,opportunity_type);
create index if not exists idx_resources_public on public.resources(is_published,membership_level);
create index if not exists idx_events_public on public.network_events(is_published,status,start_at);
create index if not exists idx_chapters_public on public.chapters(is_published,status,country);

-- Updated-at triggers
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['membership_applications','mentor_requests','businesses','products_services','opportunities','resources','chapters','network_events','event_registrations','member_success_stories'] LOOP
    EXECUTE format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    EXECUTE format('create trigger set_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- RLS
alter table public.membership_applications enable row level security;
alter table public.mentor_requests enable row level security;
alter table public.businesses enable row level security;
alter table public.products_services enable row level security;
alter table public.opportunities enable row level security;
alter table public.resources enable row level security;
alter table public.chapters enable row level security;
alter table public.network_events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.member_success_stories enable row level security;

-- Read policies support direct Supabase access later; the Express API uses service access.
drop policy if exists "Published businesses are public" on public.businesses;
create policy "Published businesses are public" on public.businesses for select to anon,authenticated using (is_published=true);
drop policy if exists "Published products are public" on public.products_services;
create policy "Published products are public" on public.products_services for select to anon,authenticated using (is_published=true);
drop policy if exists "Published opportunities are public" on public.opportunities;
create policy "Published opportunities are public" on public.opportunities for select to anon,authenticated using (is_published=true);
drop policy if exists "Published resources are visible" on public.resources;
drop policy if exists "Public resources are visible" on public.resources;
drop policy if exists "Members view eligible resources" on public.resources;
create policy "Public resources are visible" on public.resources
  for select to anon
  using (is_published=true and membership_level='all');
create policy "Members view eligible resources" on public.resources
  for select to authenticated
  using (
    is_published=true and (
      membership_level='all' or exists (
        select 1 from public.profiles p
        where p.id=auth.uid() and p.membership_status='active' and (
          p.membership_level='elite' or
          (p.membership_level='legacy' and public.resources.membership_level in ('rise','legacy')) or
          (p.membership_level='rise' and public.resources.membership_level='rise')
        )
      )
    )
  );
drop policy if exists "Published chapters are public" on public.chapters;
create policy "Published chapters are public" on public.chapters for select to anon,authenticated using (is_published=true);
drop policy if exists "Published network events are public" on public.network_events;
create policy "Published network events are public" on public.network_events for select to anon,authenticated using (is_published=true);
drop policy if exists "Published member stories are public" on public.member_success_stories;
create policy "Published member stories are public" on public.member_success_stories for select to anon,authenticated using (is_published=true);
drop policy if exists "Members view own membership applications" on public.membership_applications;
create policy "Members view own membership applications" on public.membership_applications for select to authenticated using (user_id=auth.uid() or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "Members view own mentor requests" on public.mentor_requests;
create policy "Members view own mentor requests" on public.mentor_requests for select to authenticated using (requester_id=auth.uid() or lower(requester_email)=lower(coalesce(auth.jwt()->>'email','')));
drop policy if exists "Members view own event registrations" on public.event_registrations;
create policy "Members view own event registrations" on public.event_registrations for select to authenticated using (user_id=auth.uid() or lower(email)=lower(coalesce(auth.jwt()->>'email','')));

grant select on public.businesses, public.products_services, public.opportunities, public.resources, public.chapters, public.network_events, public.member_success_stories to anon,authenticated;
grant select on public.membership_applications, public.mentor_requests, public.event_registrations to authenticated;

-- Branded Phase 1 demo imagery
update public.current_needs set image_url='/assets/brand/event-community.webp' where slug='back-to-school-kits-120-students';
update public.current_needs set image_url='/assets/brand/event-panel.webp' where slug='hygiene-essentials-displaced-families';
update public.current_needs set image_url='/assets/brand/event-founder.webp' where slug='warm-blankets-winter-outreach';
update public.campaigns set image_url='/assets/brand/event-keynote.webp' where image_url is null or image_url like 'https://images.unsplash.com/%';

-- Sample public member/mentor records use existing auth profiles when available.
update public.profiles set
  headline=coalesce(headline,'Community leader and Women Rise Legacy ambassador'),
  bio=coalesce(bio,'Committed to women’s empowerment, purposeful leadership, community connection, and creating opportunities that help other women rise.'),
  skills=case when cardinality(skills)=0 then array['Leadership','Community Building','Mentorship'] else skills end,
  membership_level=coalesce(membership_level,'elite'), membership_status='active', is_directory_visible=true,
  is_mentor=true, mentor_expertise=case when cardinality(mentor_expertise)=0 then array['Leadership','Personal Brand','Community Impact'] else mentor_expertise end,
  mentor_availability=coalesce(mentor_availability,'Two mentoring conversations per month'),
  avatar_url=coalesce(avatar_url,'/assets/brand/founder.webp'),
  country=coalesce(country,'United States'), city=coalesce(city,'Global')
where role='admin';

insert into public.businesses (name,slug,owner_name,description,industry,country,city,website_url,email,image_url,virtual_services,is_verified,is_featured,is_published) values
('Legacy Leadership Studio','legacy-leadership-studio','Women Rise Legacy Team','Leadership development, executive presence, personal brand strategy, and community-centered growth programs for women.','Leadership Consulting','United States','Atlanta',null,'hello@womenriselegacy.org','/assets/brand/event-founder.webp',true,true,true,true),
('Rise & Thrive Creative','rise-thrive-creative','Alicia Monroe','Brand identity, content strategy, and digital design services helping women-led companies communicate with clarity and confidence.','Marketing & Branding','United States','Washington, DC',null,'creative@example.com','/assets/brand/website-concept.webp',true,true,true,true),
('Nourish Her Wellness','nourish-her-wellness','Dr. Maya Brooks','A women-centered wellness practice focused on sustainable routines, community education, and holistic wellbeing.','Health & Wellness','United States','Houston',null,'wellness@example.com','/assets/brand/event-panel.webp',true,true,false,true)
on conflict (slug) do update set description=excluded.description,image_url=excluded.image_url,is_published=true;

insert into public.products_services (business_id,title,slug,item_type,description,price,currency,image_url,external_purchase_url,contact_url,category,is_featured,is_published)
select id,'Leadership Clarity Session','leadership-clarity-session','service','A focused strategy session for women navigating leadership, visibility, or a professional transition.',175,'usd','/assets/brand/event-founder.webp',null,'mailto:hello@womenriselegacy.org','Coaching',true,true from public.businesses where slug='legacy-leadership-studio'
on conflict (slug) do update set description=excluded.description,is_published=true;
insert into public.products_services (business_id,title,slug,item_type,description,price,currency,image_url,external_purchase_url,contact_url,category,is_featured,is_published)
select id,'Brand Foundation Intensive','brand-foundation-intensive','service','A strategic brand foundation package covering audience, positioning, visual direction, and launch priorities.',950,'usd','/assets/brand/website-concept.webp',null,'mailto:creative@example.com','Branding',true,true from public.businesses where slug='rise-thrive-creative'
on conflict (slug) do update set description=excluded.description,is_published=true;

insert into public.opportunities (title,slug,opportunity_type,organization,location,work_mode,deadline,eligibility,description,application_url,contact_email,is_featured,is_published) values
('Women in Leadership Speaker Call','women-leadership-speaker-call','Speaking Opportunity','Women Rise Legacy Network','Global','virtual',current_date + 45,'Women leaders, founders, educators, and community builders with a practical story or framework to share.','Submit a proposed session for an upcoming Women Rise Legacy leadership conversation.',null,'events@womenriselegacy.org',true,true),
('Community Impact Micro-Grant','community-impact-micro-grant','Grant','Legacy Impact Fund','United States','hybrid',current_date + 60,'Women-led community initiatives with a clear local need, realistic budget, and measurable impact plan.','Small grants supporting education, family stability, women’s development, and community outreach.',null,'grants@womenriselegacy.org',true,true),
('Member Business Vendor Showcase','member-business-vendor-showcase','Vendor Event','Women Rise Legacy Network','Atlanta, GA','onsite',current_date + 30,'Active members with a women-owned product or service business.','Apply for a vendor position and introduce your business to the Women Rise Legacy community.',null,'business@womenriselegacy.org',false,true)
on conflict (slug) do update set deadline=excluded.deadline,description=excluded.description,is_published=true;

insert into public.resources (title,slug,description,resource_type,file_url,external_url,image_url,membership_level,download_instructions,is_published) values
('Personal Brand Clarity Worksheet','personal-brand-clarity-worksheet','A guided worksheet to define your audience, strengths, values, message, and next visibility action.','Worksheet',null,null,'/assets/brand/brand-guide.webp','rise','Sign in and request access through your member dashboard.',true),
('Women-Owned Business Visibility Checklist','business-visibility-checklist','A practical checklist covering directory readiness, credibility signals, content, partnerships, and conversion paths.','Checklist',null,null,'/assets/brand/website-concept.webp','legacy','Available to Legacy and Elite members.',true),
('Legacy Leadership Reflection Guide','legacy-leadership-reflection-guide','A private reflection framework for established women leaders aligning influence, service, and long-term legacy.','Guide',null,null,'/assets/brand/event-keynote.webp','elite','Available to Elite members.',true),
('Community Partnership Starter Guide','community-partnership-starter-guide','A public overview for organizations interested in volunteering, outreach, sponsorship, or program partnerships.','Guide',null,null,'/assets/brand/event-community.webp','all','Contact the partnership team for an editable version.',true)
on conflict (slug) do update set description=excluded.description,image_url=excluded.image_url,is_published=true;

insert into public.chapters (name,slug,city,state,country,leader_name,contact_email,image_url,meeting_schedule,description,status,is_published) values
('Women Rise Legacy Atlanta','women-rise-legacy-atlanta','Atlanta','Georgia','United States','Chapter Leadership Team','atlanta@womenriselegacy.org','/assets/brand/event-community.webp','Monthly leadership circle and quarterly networking gathering','A local chapter connecting women leaders, entrepreneurs, mentors, volunteers, and community partners across greater Atlanta.','active',true),
('Women Rise Legacy Washington DC','women-rise-legacy-washington-dc','Washington','District of Columbia','United States','Chapter Leadership Team','dc@womenriselegacy.org','/assets/brand/event-panel.webp','Bi-monthly networking and professional development sessions','A chapter focused on professional connection, civic leadership, business visibility, and community outreach.','forming',true),
('Women Rise Legacy Global Virtual','women-rise-legacy-global-virtual','Online',null,'Global','Global Community Team','global@womenriselegacy.org','/assets/brand/event-keynote.webp','Virtual gathering on the first Thursday of each month','A virtual chapter for women who want meaningful global connections without geographic limits.','active',true)
on conflict (slug) do update set description=excluded.description,image_url=excluded.image_url,is_published=true;

insert into public.network_events (title,slug,event_type,description,start_at,end_at,location,is_virtual,registration_url,image_url,capacity,status,is_published) values
('Legacy Leadership Conversation','legacy-leadership-conversation','Leadership Workshop','An interactive conversation on values-led leadership, visibility, resilience, and building a legacy that creates opportunities for others.',date_trunc('day',now()) + interval '21 days 18 hours',date_trunc('day',now()) + interval '21 days 20 hours','Virtual',true,null,'/assets/brand/event-keynote.webp',250,'upcoming',true),
('Women-Owned Business Connection Night','women-owned-business-connection-night','Networking','A curated evening for founders, service providers, professionals, mentors, and partners to connect and exchange opportunities.',date_trunc('day',now()) + interval '35 days 17 hours',date_trunc('day',now()) + interval '35 days 20 hours','Atlanta, Georgia',false,null,'/assets/brand/event-community.webp',140,'upcoming',true),
('Mentorship Match Orientation','mentorship-match-orientation','Mentorship','A practical orientation for members and mentors covering goals, boundaries, communication, and making the most of a mentorship relationship.',date_trunc('day',now()) + interval '49 days 18 hours',date_trunc('day',now()) + interval '49 days 19 hours 30 minutes','Virtual',true,null,'/assets/brand/event-panel.webp',180,'upcoming',true)
on conflict (slug) do update set start_at=excluded.start_at,end_at=excluded.end_at,description=excluded.description,image_url=excluded.image_url,is_published=true;

insert into public.member_success_stories (title,slug,member_name,achievement,story,image_url,publish_date,is_published) values
('From Quiet Expertise to Visible Leadership','quiet-expertise-visible-leadership','Danielle Carter','Leadership & Visibility','After years of contributing behind the scenes, Danielle clarified her leadership message, accepted a speaking opportunity, and began mentoring emerging professionals in her industry. Her growth became a pathway for other women to be seen.','/assets/brand/event-founder.webp',current_date - 28,true),
('A Business Built Through Community','business-built-through-community','Alicia Monroe','Women-Owned Business Growth','Alicia used community feedback and strategic introductions to refine her offer, strengthen her brand, and secure collaborative projects with other member businesses.','/assets/brand/event-community.webp',current_date - 50,true),
('Turning Recovery into Community Service','recovery-into-community-service','Maya Brooks','Community Impact','Maya transformed a difficult personal season into a wellness education initiative that now supports women with practical routines, connection, and compassionate accountability.','/assets/brand/event-panel.webp',current_date - 75,true)
on conflict (slug) do update set story=excluded.story,image_url=excluded.image_url,is_published=true;
