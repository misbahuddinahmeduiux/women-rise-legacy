-- WOMEN RISE LEGACY PHASE 4 — PATCHED SQL
-- Fix: JSON values use PostgreSQL dollar quoting to prevent quote/paste parsing errors.
-- Safe to re-run after the original Phase 4 SQL failed.
-- Generated from PHASE-4-DYNAMIC-CMS.sql.

-- WOMEN RISE LEGACY — PHASE 4
-- Membership, subscriptions, mentorship, podcast, media and dynamic website CMS.
-- Safe to re-run after Phase 3.1.

create extension if not exists pgcrypto;

-- Membership plans are fully managed by the admin panel.
create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  access_level text not null check (access_level in ('rise','legacy','elite')),
  tagline text,
  description text not null,
  features jsonb not null default $wrljson$[]$wrljson$::jsonb,
  currency text not null default 'usd' check (char_length(currency)=3),
  monthly_enabled boolean not null default true,
  monthly_price numeric(12,2),
  yearly_enabled boolean not null default true,
  yearly_price numeric(12,2),
  one_time_enabled boolean not null default false,
  one_time_price numeric(12,2),
  one_time_duration_months integer,
  one_time_lifetime boolean not null default false,
  auto_renew boolean not null default true,
  trial_days integer not null default 0 check (trial_days >= 0),
  grace_period_days integer not null default 7 check (grace_period_days >= 0),
  mentorship_access text not null default 'browse' check (mentorship_access in ('browse','request','priority')),
  directory_access boolean not null default true,
  business_listing boolean not null default false,
  featured_visibility boolean not null default false,
  badge_text text,
  is_featured boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not monthly_enabled or monthly_price is not null),
  check (not yearly_enabled or yearly_price is not null),
  check (not one_time_enabled or one_time_price is not null)
);

create sequence if not exists public.membership_receipt_seq start 1001;

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  billing_cycle text not null check (billing_cycle in ('monthly','yearly','one_time')),
  provider text not null check (provider in ('stripe','paypal','bank_transfer','demo','complimentary')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','processing','paid','failed','refunded','cancelled')),
  provider_session_id text unique,
  provider_payment_id text,
  provider_subscription_id text,
  receipt_number text unique,
  receipt_token uuid not null default gen_random_uuid(),
  provider_payload jsonb not null default $wrljson${}$wrljson$::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  payment_id uuid references public.membership_payments(id) on delete set null,
  billing_cycle text not null check (billing_cycle in ('monthly','yearly','one_time')),
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null default 'pending' check (status in ('pending','trialing','active','past_due','paused','cancelled','expired')),
  starts_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  grace_ends_at timestamptz,
  metadata jsonb not null default $wrljson${}$wrljson$::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_provider_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.membership_plans(id) on delete cascade,
  provider text not null check (provider in ('stripe','paypal')),
  provider_mode text not null default 'test' check (provider_mode in ('test','live')),
  billing_cycle text not null check (billing_cycle in ('monthly','yearly')),
  external_product_id text,
  external_price_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id,provider,provider_mode,billing_cycle)
);

create or replace function public.assign_membership_receipt()
returns trigger language plpgsql as $$
begin
  if new.status='paid' and new.receipt_number is null then
    new.receipt_number := 'WRL-M-' || to_char(coalesce(new.paid_at,new.created_at,now()),'YYYY') || '-' || lpad(nextval('public.membership_receipt_seq')::text,6,'0');
  end if;
  return new;
end; $$;

drop trigger if exists assign_membership_receipt_trigger on public.membership_payments;
create trigger assign_membership_receipt_trigger before insert or update on public.membership_payments
for each row execute procedure public.assign_membership_receipt();

-- Mentorship operations.
create table if not exists public.mentorship_matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.mentor_requests(id) on delete set null,
  member_id uuid not null references public.profiles(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  goals text,
  status text not null default 'pending_mentor' check (status in ('pending_mentor','active','paused','completed','declined','cancelled')),
  priority text not null default 'standard' check (priority in ('standard','priority','private')),
  starts_at timestamptz,
  ended_at timestamptz,
  member_notes text,
  mentor_private_notes text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mentor_sessions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.mentorship_matches(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
  meeting_url text,
  location text,
  agenda text,
  member_notes text,
  mentor_private_notes text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Podcast CMS.
create table if not exists public.podcast_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.podcast_guests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  designation text,
  bio text,
  image_url text,
  mentor_id uuid references public.profiles(id) on delete set null,
  website_url text,
  linkedin_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  episode_number integer,
  category_id uuid references public.podcast_categories(id) on delete set null,
  guest_id uuid references public.podcast_guests(id) on delete set null,
  guest_name text,
  guest_designation text,
  short_description text not null,
  show_notes text not null,
  cover_image_url text,
  audio_url text,
  youtube_url text,
  spotify_url text,
  apple_podcasts_url text,
  duration_minutes integer,
  publish_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dynamic website content and reusable options.
create table if not exists public.website_content (
  id uuid primary key default gen_random_uuid(),
  content_key text unique not null,
  label text not null,
  content_type text not null default 'section' check (content_type in ('section','page','navigation','footer','announcement','seo')),
  value jsonb not null default $wrljson${}$wrljson$::jsonb,
  is_published boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_options (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  label text not null,
  value text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_key,value)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text unique not null,
  public_url text not null,
  mime_type text not null,
  file_size bigint not null,
  alt_text text,
  title text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Store the exact rendered content used for each queued email.
alter table public.email_queue add column if not exists html_body text;
alter table public.email_queue add column if not exists text_body text;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text unique not null,
  name text not null,
  subject text not null,
  html_body text not null,
  text_body text,
  available_variables jsonb not null default $wrljson$[]$wrljson$::jsonb,
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing profiles receive lifecycle fields.
alter table public.profiles add column if not exists membership_plan_id uuid references public.membership_plans(id) on delete set null;
alter table public.profiles add column if not exists membership_started_at timestamptz;
alter table public.profiles add column if not exists membership_expires_at timestamptz;
alter table public.profiles add column if not exists membership_billing_cycle text check (membership_billing_cycle in ('monthly','yearly','one_time'));
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists languages text[] default '{}';
alter table public.profiles add column if not exists mentor_title text;
alter table public.profiles add column if not exists mentor_years_experience integer;
alter table public.profiles add column if not exists mentor_session_type text;
alter table public.profiles add column if not exists mentor_featured boolean not null default false;

alter table public.profiles drop constraint if exists profiles_membership_status_check;
alter table public.profiles add constraint profiles_membership_status_check check (membership_status in ('inactive','pending','trialing','active','past_due','paused','cancelled','expired'));

alter table public.membership_subscriptions drop constraint if exists membership_subscriptions_status_check;
alter table public.membership_subscriptions add constraint membership_subscriptions_status_check check (status in ('pending','trialing','active','past_due','paused','cancelled','expired'));


-- Seed agreed Rise / Legacy / Elite plans. Admin can edit all values later.
insert into public.membership_plans
(name,slug,access_level,tagline,description,features,currency,monthly_enabled,monthly_price,yearly_enabled,yearly_price,one_time_enabled,one_time_price,one_time_lifetime,mentorship_access,directory_access,business_listing,featured_visibility,badge_text,is_featured,display_order)
values
('Rise','rise','rise','Community','A welcoming starting point for connection, learning, and community visibility.',
 $wrljson$["Member directory access","Community events and networking","Selected resource library access","Opportunity alerts","Volunteer pathways"]$wrljson$::jsonb,
 'usd',true,19,true,190,false,null,false,'browse',true,false,false,null,false,10),
('Legacy','legacy','legacy','Growth','For women actively building careers, businesses, influence, and leadership capacity.',
 $wrljson$["Everything in Rise","Submit mentorship requests","Business directory listing","Expanded resource access","Leadership workshops","Featured member opportunities"]$wrljson$::jsonb,
 'usd',true,39,true,390,false,null,false,'request',true,true,false,'Most popular',true,20),
('Elite','elite','elite','Leadership','A high-touch pathway for established leaders, founders, and women ready to expand their legacy.',
 $wrljson$["Everything in Legacy","Priority and private mentorship","Premium visibility","Leadership roundtables","Speaker and media consideration","Strategic introductions"]$wrljson$::jsonb,
 'usd',true,79,true,790,true,1999,true,'priority',true,true,true,'Premium',false,30)
on conflict(slug) do nothing;

insert into public.podcast_categories(name,slug,description,display_order)
values ('Leadership','leadership','Leadership conversations and practical guidance.',10),('Legacy Stories','legacy-stories','Stories of resilience, growth and community impact.',20)
on conflict(slug) do nothing;

insert into public.website_content(content_key,label,content_type,value,is_published) values
('homepage.hero','Homepage hero slider','section',$wrljson${"slides":[{"eyebrow":"Women Rise Legacy Network","title":"Heal. Build. Lead. Leave a Legacy.","text":"A global community helping women grow through mentorship, leadership, enterprise, connection, and humanitarian impact.","image":"/assets/brand/hero-network.webp","primaryLabel":"Explore membership","primaryTo":"/membership","secondaryLabel":"Make an impact","secondaryTo":"/get-involved"}]}$wrljson$::jsonb,true),
('homepage.founder','Homepage founder section','section',$wrljson${"eyebrow":"Founder-led movement","title":"Built to help women turn healing into leadership","text":"Women Rise Legacy brings community, mentorship, education, enterprise, and humanitarian service into one trusted ecosystem.","image":"/assets/brand/founder-transparent.png","buttonLabel":"Read our story","buttonTo":"/about"}$wrljson$::jsonb,true),
('homepage.cta','Homepage final call to action','section',$wrljson${"eyebrow":"Your next chapter starts here","title":"Join a network built for women who are ready to heal, build, lead, and leave a legacy.","text":"Become a member, find a mentor, list your business, volunteer, or support a verified humanitarian need.","primaryLabel":"Explore membership","primaryTo":"/membership","secondaryLabel":"Make an impact","secondaryTo":"/get-involved"}$wrljson$::jsonb,true),
('page.about','About page','page',$wrljson${"seoTitle":"About Women Rise Legacy","seoDescription":"Learn how Women Rise Legacy connects women through mentorship, leadership, enterprise, community, and humanitarian service.","eyebrow":"Who we are","title":"A women-led movement connecting growth with service","heroText":"Women Rise Legacy Network supports women through mentorship, leadership, business visibility, resources, events, chapters, and a humanitarian Foundation serving families and communities.","founderEyebrow":"Our founder's vision","founderTitle":"When women rise with support, communities inherit the impact","founderText":"Women Rise Legacy was built around a clear belief: women should not have to build alone. The Network creates spaces for healing, professional growth, entrepreneurship, leadership, and meaningful connection. The Foundation turns that strength outward through practical aid, sponsorship, volunteer action, and responsible partnerships.","founderImage":"/assets/brand/event-founder.webp","founderImageAlt":"Women Rise Legacy founder speaking","founderBadge":"Heal. Build. Lead.","commitments":["Help women build confidence, skills, and visible leadership","Create trusted mentorship and business connections","Support women-owned businesses and professional opportunities","Protect dignity and privacy in humanitarian workflows","Turn individual growth into community legacy"],"founderButtonLabel":"Explore membership","founderButtonTo":"/membership","pillarsEyebrow":"Our pillars","pillarsTitle":"Five commitments shape every program","pillars":[{"icon":"sparkles","title":"Empower","text":"Build confidence, voice, and personal agency."},{"icon":"heart","title":"Support","text":"Create community care and practical pathways."},{"icon":"education","title":"Educate","text":"Share tools, insight, and development opportunities."},{"icon":"crown","title":"Lead","text":"Prepare women to lead with values and visibility."},{"icon":"hand","title":"Legacy","text":"Use growth to create opportunity for others."}],"armsImage":"/assets/brand/event-community.webp","armsImageAlt":"Women Rise Legacy community","armsEyebrow":"One brand, two impact arms","armsTitle":"Network growth and Foundation service work together","networkTitle":"Women Rise Legacy Network","networkText":"Focuses on membership, mentorship, leadership, entrepreneurship, directories, resources, events, and chapters.","foundationTitle":"Women Rise Legacy Foundation","foundationText":"Focuses on financial giving, item donations, current needs, family sponsorship, assistance requests, volunteers, partners, disaster response, and impact reporting.","networkButtonLabel":"Meet the network","networkButtonTo":"/members","foundationButtonLabel":"Support the Foundation","foundationButtonTo":"/get-involved"}$wrljson$::jsonb,true),
('page.programs','Programs page','page',$wrljson${"seoTitle":"Programs","seoDescription":"Explore Women Rise Legacy mentorship, leadership, enterprise, education, assistance, relief, and chapter programs.","eyebrow":"Programs","title":"Practical programs across Network growth and Foundation service","heroText":"Our programs connect immediate support with leadership, enterprise, learning, and long-term community resilience.","programs":[{"title":"Leadership & Mentorship","text":"Mentor matching, leadership conversations, visibility, and professional development.","icon":"crown"},{"title":"Business & Opportunity","text":"Women-owned business visibility, product and service discovery, opportunities, and collaboration.","icon":"building"},{"title":"Family Assistance","text":"Verified help for clothing, hygiene, baby items, blankets, and household essentials.","icon":"heart"},{"title":"Education Support","text":"School supplies, learning materials, scholarships, and community education projects.","icon":"education"},{"title":"Disaster Relief","text":"Rapid fundraising and item coordination during emergencies and displacement.","icon":"hand"},{"title":"Community & Chapters","text":"Local and virtual spaces for networking, workshops, outreach, and leadership.","icon":"users"}]}$wrljson$::jsonb,true),
('page.get-involved','Get involved page','page',$wrljson${"seoTitle":"Get Involved","seoDescription":"Join, volunteer, donate, partner, find mentorship, or support women-owned businesses through Women Rise Legacy.","eyebrow":"Take action","title":"Choose how you want to grow, connect, or contribute","heroText":"Women Rise Legacy offers pathways for personal growth, professional connection, business visibility, and humanitarian service.","actions":[{"title":"Become a member","text":"Join a community designed for connection, development, visibility, and leadership.","to":"/membership","icon":"crown","buttonLabel":"Get started"},{"title":"Find a mentor","text":"Request guidance based on your goals, preferred topics, and availability.","to":"/mentors","icon":"users","buttonLabel":"Get started"},{"title":"List or discover a business","text":"Support women-owned businesses and professional service providers.","to":"/businesses","icon":"building","buttonLabel":"Get started"},{"title":"Donate money","text":"Support campaigns, current needs, or a family through a secure donation flow.","to":"/donate","icon":"hand","buttonLabel":"Get started"},{"title":"Donate useful items","text":"Offer clothing, school supplies, hygiene items, baby essentials, toys, or blankets.","to":"/donate-items","icon":"package","buttonLabel":"Get started"},{"title":"Volunteer or partner","text":"Share skills, logistics support, sponsorship, outreach, or organizational capacity.","to":"/volunteer","icon":"heart","buttonLabel":"Get started"}]}$wrljson$::jsonb,true),
('page.membership','Membership page','page',$wrljson${"seoTitle":"Membership Plans","seoDescription":"Compare dynamic Rise, Legacy, and Elite Women Rise Legacy membership plans.","eyebrow":"Membership pathways","title":"Choose the membership that matches your next chapter","heroText":"Membership plans, prices, billing options, and benefits are managed directly by the Women Rise Legacy team.","signedInButton":"Open member dashboard","signedOutButton":"Create your account","activationEyebrow":"Automatic activation","activationTitle":"Your access begins after verified payment","activationText":"After Stripe or PayPal confirms a successful payment, the selected membership activates automatically. You receive plan-based access, a payment record, and a membership confirmation email.","activationImage":"/assets/brand/event-panel.webp","activationImageAlt":"Women Rise Legacy members in conversation","trustItems":["Verified gateway confirmation","Immediate plan access","Renewal and expiry management"]}$wrljson$::jsonb,true),
('page.podcast','Podcast page','page',$wrljson${"seoTitle":"Women Rise Legacy Podcast","seoDescription":"Leadership, mentorship, entrepreneurship, healing, and legacy conversations from Women Rise Legacy.","eyebrow":"Women Rise Legacy Podcast","title":"Conversations that help women heal, build, lead, and leave a legacy","heroText":"Listen to mentors, founders, leaders, and community voices share practical guidance and stories worth carrying forward.","searchPlaceholder":"Search episodes or guests","allCategoriesLabel":"All categories","emptyTitle":"No podcast episodes published yet","emptyText":"New conversations will appear here when the team publishes them.","listenLabel":"Listen to episode","newLabel":"New"}$wrljson$::jsonb,true),
('page.members','Member directory page','page',$wrljson${"seoTitle":"Member Directory","seoDescription":"Discover Women Rise Legacy members across industries, cities, skills, and leadership interests.","eyebrow":"Member directory","title":"Meet women building lives, businesses, and legacies","heroText":"Active Rise, Legacy, and Elite members can discover members across industries, cities, skills, and leadership interests."}$wrljson$::jsonb,true),
('page.mentors','Mentor directory page','page',$wrljson${"seoTitle":"Mentor Center","seoDescription":"Browse trusted Women Rise Legacy mentors and request guidance based on your goals.","eyebrow":"Mentor center","title":"Guidance from women who have walked the road","heroText":"Active members can browse mentor profiles. Legacy members can submit requests, and Elite members receive priority/private matching."}$wrljson$::jsonb,true),
('page.businesses','Business directory page','page',$wrljson${"seoTitle":"Women-Owned Business Directory","seoDescription":"Explore verified Women Rise Legacy member businesses and professional services.","eyebrow":"Women-owned business directory","title":"Buy, hire, partner, and grow through women-led enterprise","heroText":"Explore verified member businesses and professional services across industries and locations."}$wrljson$::jsonb,true),
('page.products-services','Products and services page','page',$wrljson${"seoTitle":"Products and Services","seoDescription":"Discover products and professional services from women-led brands in the Women Rise Legacy network.","eyebrow":"Member marketplace","title":"Products and services from women-led brands","heroText":"Discover products and services from verified member businesses."}$wrljson$::jsonb,true),
('page.opportunities','Opportunities page','page',$wrljson${"seoTitle":"Opportunity Center","seoDescription":"Find curated jobs, grants, scholarships, speaking opportunities, vendor events, and conferences.","eyebrow":"Opportunity center","title":"Find your next opening, grant, stage, or learning opportunity","heroText":"Curated jobs, scholarships, grants, speaking opportunities, vendor events, and conferences for women."}$wrljson$::jsonb,true),
('page.resources','Resources page','page',$wrljson${"seoTitle":"Resource Library","seoDescription":"Access practical Women Rise Legacy resources for business, leadership, career, and personal growth.","eyebrow":"Resource library","title":"Practical tools for business, leadership, career, and personal growth","heroText":"Resources display according to their published access level. Members can sign in to see their eligible library."}$wrljson$::jsonb,true),
('page.events','Events page','page',$wrljson${"seoTitle":"Events","seoDescription":"Explore Women Rise Legacy networking events, leadership workshops, chapter gatherings, and virtual sessions.","eyebrow":"Events and experiences","title":"Gather, learn, network, and lead","heroText":"Explore Women Rise Legacy networking events, leadership workshops, chapter gatherings, and virtual sessions."}$wrljson$::jsonb,true),
('page.chapters','Chapters page','page',$wrljson${"seoTitle":"Local Chapters","seoDescription":"Find Women Rise Legacy chapters creating local spaces for networking, leadership, and community action.","eyebrow":"Local chapters","title":"Global vision. Local relationships.","heroText":"Chapters create trusted spaces for networking, leadership development, outreach, and community action."}$wrljson$::jsonb,true),
('page.success-stories','Success stories page','page',$wrljson${"seoTitle":"Member Success Stories","seoDescription":"Celebrate Women Rise Legacy members building businesses, changing careers, leading communities, and creating impact.","eyebrow":"Member success stories","title":"Every breakthrough becomes part of the legacy","heroText":"Celebrate women who are building businesses, changing careers, leading communities, and creating impact."}$wrljson$::jsonb,true),
('page.current-needs','Current needs page','page',$wrljson${"seoTitle":"Current Needs","seoDescription":"Support verified Women Rise Legacy family and community needs by country or category.","eyebrow":"Current needs","title":"Give where support is needed now","heroText":"Filter verified needs by country or category, then choose an external wishlist, an item donation, or financial support."}$wrljson$::jsonb,true),
('page.campaigns','Campaigns page','page',$wrljson${"seoTitle":"Campaigns","seoDescription":"Support focused Women Rise Legacy humanitarian campaigns and follow public progress.","eyebrow":"Campaigns","title":"Support a focused humanitarian response","heroText":"Campaigns combine financial goals, item needs, partner coordination, and public progress updates."}$wrljson$::jsonb,true),
('page.sponsor-families','Sponsor families page','page',$wrljson${"seoTitle":"Sponsor a Family","seoDescription":"Offer consistent support through privacy-protected Women Rise Legacy family sponsorship profiles.","eyebrow":"Sponsor a family","title":"Offer consistent support while protecting family dignity","heroText":"Profiles use public aliases, general locations, and verified summaries. Private identity information is never displayed."}$wrljson$::jsonb,true),
('page.impact','Impact page','page',$wrljson${"seoTitle":"Impact and Accountability","seoDescription":"Explore Women Rise Legacy countries served, impact stories, and transparent public reports.","eyebrow":"Impact and accountability","title":"See where support goes and what it achieves","heroText":"Explore countries served, consent-based impact stories, and public reports covering people supported, items distributed, and funds used.","reachEyebrow":"Global reach","reachTitle":"Communities connected through trusted partners","reachText":"Select a marker to view current country-level activity. Exact beneficiary addresses are never shown.","reportsEyebrow":"Public reporting","reportsTitle":"Impact reports","reportsText":"Download approved reports when a PDF is available, or review the published summary and outcome totals.","storiesEyebrow":"Stories of change","storiesTitle":"Responsible, consent-based updates","storiesText":"Stories focus on outcomes while limiting personal details and protecting dignity."}$wrljson$::jsonb,true),
('page.membership-apply','Membership goals page','page',$wrljson${"seoTitle":"Membership Goals","seoDescription":"Share your goals before choosing a Women Rise Legacy membership plan.","eyebrow":"Membership goals","title":"Tell us where you are and where you want to grow","heroText":"This optional form helps the team understand relevant resources and connections. Membership activates automatically after verified payment."}$wrljson$::jsonb,true),
('page.mentor-request','Mentor request page','page',$wrljson${"seoTitle":"Request Mentorship","seoDescription":"Legacy and Elite members can request guidance from Women Rise Legacy mentors.","eyebrow":"Mentorship request","title":"Ask for guidance with clarity and intention","heroText":"Legacy members can submit mentorship requests. Elite members receive priority or private matching based on availability."}$wrljson$::jsonb,true),
('page.donate','Donate page','page',$wrljson${"seoTitle":"Donate","seoDescription":"Support Women Rise Legacy through secure one-time or monthly giving.","eyebrow":"Financial donation","title":"Turn generosity into verified action","heroText":"Choose a one-time or monthly donation and support verified Women Rise Legacy programs."}$wrljson$::jsonb,true),
('page.donate-items','Donate items page','page',$wrljson${"seoTitle":"Donate Items","seoDescription":"Offer useful items for approved Women Rise Legacy community needs.","eyebrow":"Donate items","title":"Offer useful goods for approved community needs","heroText":"Submit item details first. An administrator will review suitability and send approved shipping instructions."}$wrljson$::jsonb,true),
('page.request-assistance','Request assistance page','page',$wrljson${"seoTitle":"Request Assistance","seoDescription":"Submit a private and respectful request for Women Rise Legacy Foundation assistance.","eyebrow":"Private application","title":"Request assistance safely and respectfully","heroText":"This form is reviewed privately. Submitting a request does not automatically publish personal information or guarantee approval."}$wrljson$::jsonb,true),
('page.volunteer','Volunteer page','page',$wrljson${"seoTitle":"Volunteer","seoDescription":"Volunteer your time, skills, local knowledge, and professional experience with Women Rise Legacy.","eyebrow":"Volunteer","title":"Contribute your skills, time, and local knowledge","heroText":"Volunteer opportunities may include outreach, translation, logistics, events, verification support, fundraising, and professional services."}$wrljson$::jsonb,true),
('page.partners','Partners page','page',$wrljson${"seoTitle":"Partner With Us","seoDescription":"Build responsible community impact through a Women Rise Legacy partnership.","eyebrow":"Partnerships","title":"Build responsible impact through collaboration","heroText":"Nonprofits, schools, community groups, companies, and local leaders can submit a partnership request."}$wrljson$::jsonb,true),
('page.contact','Contact page','page',$wrljson${"seoTitle":"Contact Women Rise Legacy","seoDescription":"Contact the Women Rise Legacy team about membership, programs, partnerships, campaigns, or support.","eyebrow":"Contact","title":"Talk with the Women Rise Legacy team","heroText":"Send a general question, campaign inquiry, partnership note, or request for guidance."}$wrljson$::jsonb,true),
('page.shipment-tracking','Shipment tracking page','page',$wrljson${"seoTitle":"Donation Shipment Tracking","seoDescription":"Submit tracking details for approved item donations sent to Women Rise Legacy.","eyebrow":"Shipment tracking","title":"Tell us when approved donated items are on the way","heroText":"Submit tracking only after the Foundation has reviewed your item offer and provided an approved delivery address."}$wrljson$::jsonb,true),
('homepage.gallery','Homepage community gallery','section',$wrljson${"eyebrow":"A community in motion","title":"Leadership, connection, and real conversations","images":[{"url":"/assets/brand/event-community.webp","alt":"Women Rise Legacy community event"},{"url":"/assets/brand/event-panel.webp","alt":"Women Rise Legacy panel conversation"},{"url":"/assets/brand/event-keynote.webp","alt":"Women Rise Legacy keynote"}]}$wrljson$::jsonb,true),
('homepage.sections','Homepage section labels and cards','section',$wrljson${"seoTitle":"Women Rise Legacy Network","seoDescription":"A women-led network for mentorship, leadership, business visibility, community connection, and humanitarian impact.","trustItems":[{"icon":"shield","text":"Verified community"},{"icon":"heart","text":"Dignity-first support"},{"icon":"network","text":"Global connections"}],"statsLabels":{"members":"Network members","businesses":"Women-led businesses","activeNeeds":"Active needs","beneficiaries":"People supported"},"founderClosingText":"Members are encouraged to grow personally, lead professionally, build sustainable ventures, and use their influence to create opportunity for other women and families.","founderPillars":[{"icon":"sparkles","title":"Empower","text":"Build confidence and clarity."},{"icon":"hand","title":"Support","text":"Access practical community care."},{"icon":"education","title":"Educate","text":"Learn skills that move careers forward."},{"icon":"crown","title":"Lead","text":"Step into visible, values-led leadership."}],"pathways":{"eyebrow":"One ecosystem, multiple pathways","title":"Grow your network and your impact","text":"Choose the pathway that meets you where you are today and supports where you want to go next.","items":[{"icon":"crown","title":"Membership","text":"Rise, Legacy, and Elite pathways for connection, visibility, resources, and leadership growth.","to":"/membership"},{"icon":"users","title":"Mentorship","text":"Browse trusted mentors and submit a guided request based on your goals and preferred topics.","to":"/mentors"},{"icon":"building","title":"Business Directory","text":"Discover women-owned businesses, professional services, and member-led brands.","to":"/businesses"},{"icon":"award","title":"Opportunities","text":"Explore jobs, grants, scholarships, speaking opportunities, vendor events, and conferences.","to":"/opportunities"}]},"businesses":{"eyebrow":"Women-owned enterprise","title":"Featured businesses","text":"Meet members turning expertise, creativity, and resilience into growing brands.","buttonLabel":"Browse directory","emptyText":"Featured businesses will appear here after they are published."},"events":{"eyebrow":"Upcoming events","title":"Connect in rooms designed for growth","text":"Join leadership conversations, networking events, workshops, and community gatherings.","buttonLabel":"View all events","detailLabel":"Event details","emptyText":"Upcoming events will appear here after they are published."},"needs":{"eyebrow":"Act where it matters","title":"Help meet a verified need","text":"The Foundation connects generosity with carefully reviewed family and community requests.","buttonLabel":"View all current needs"},"campaigns":{"eyebrow":"Featured campaigns","title":"Fund long-term and emergency response","text":"Support focused campaigns for education, family care, women’s empowerment, and disaster relief."},"stories":{"eyebrow":"Living legacies","title":"Member stories worth sharing","buttonLabel":"Read success stories"},"podcast":{"eyebrow":"Women Rise Legacy Podcast","title":"Conversations that guide, inspire, and connect","text":"Hear practical insight from mentors, founders, leaders, and women building meaningful legacies.","buttonLabel":"All episodes","listenLabel":"Listen now","newEpisodeLabel":"New"}}$wrljson$::jsonb,true),
('site.navigation','Public header navigation','navigation',$wrljson${"items":[{"type":"link","label":"Home","to":"/","enabled":true,"order":10},{"type":"link","label":"About","to":"/about","enabled":true,"order":20},{"type":"dropdown","label":"Foundation","enabled":true,"order":30,"children":[{"label":"Current Needs","to":"/current-needs","enabled":true,"order":10},{"label":"Campaigns","to":"/campaigns","enabled":true,"order":20},{"label":"Sponsor a Family","to":"/sponsor-a-family","enabled":true,"order":30},{"label":"Donate Items","to":"/donate-items","enabled":true,"order":40},{"label":"Request Assistance","to":"/request-assistance","enabled":true,"order":50}]},{"type":"dropdown","label":"Network","enabled":true,"order":40,"children":[{"label":"Membership","to":"/membership","enabled":true,"order":10},{"label":"Member Directory","to":"/members","enabled":true,"order":20},{"label":"Mentors","to":"/mentors","enabled":true,"order":30},{"label":"Business Directory","to":"/businesses","enabled":true,"order":40},{"label":"Products & Services","to":"/products-services","enabled":true,"order":50},{"label":"Local Chapters","to":"/chapters","enabled":true,"order":60},{"label":"Success Stories","to":"/success-stories","enabled":true,"order":70}]},{"type":"link","label":"Opportunities","to":"/opportunities","enabled":true,"order":50},{"type":"link","label":"Events","to":"/events","enabled":true,"order":60},{"type":"link","label":"Podcast","to":"/podcast","enabled":true,"order":70},{"type":"link","label":"Resources","to":"/resources","enabled":true,"order":80},{"type":"link","label":"Impact","to":"/impact","enabled":true,"order":90},{"type":"link","label":"Donate","to":"/donate","enabled":true,"order":100,"style":"button"}]}$wrljson$::jsonb,true),
('site.footer','Public footer navigation','footer',$wrljson${"columns":[{"title":"Network","links":[{"label":"Membership","to":"/membership","order":10},{"label":"Members","to":"/members","order":20},{"label":"Mentors","to":"/mentors","order":30},{"label":"Businesses","to":"/businesses","order":40},{"label":"Chapters","to":"/chapters","order":50}]},{"title":"Foundation","links":[{"label":"Current Needs","to":"/current-needs","order":10},{"label":"Campaigns","to":"/campaigns","order":20},{"label":"Sponsor a Family","to":"/sponsor-a-family","order":30},{"label":"Volunteer","to":"/volunteer","order":40},{"label":"Partner With Us","to":"/partners","order":50}]},{"title":"Grow & Connect","links":[{"label":"Opportunities","to":"/opportunities","order":10},{"label":"Resources","to":"/resources","order":20},{"label":"Events","to":"/events","order":30},{"label":"Success Stories","to":"/success-stories","order":40},{"label":"Podcast","to":"/podcast","order":50},{"label":"Contact","to":"/contact","order":60}]}]}$wrljson$::jsonb,true),
('site.seo','Global SEO defaults','seo',$wrljson${"titleSuffix":"Women Rise Legacy","defaultDescription":"A women-led network for mentorship, leadership, business visibility, community connection, and humanitarian impact.","socialImage":"/assets/brand/website-concept.webp","twitterCard":"summary_large_image"}$wrljson$::jsonb,true),
('site.general','General public website details','footer',$wrljson${"organizationName":"Women Rise Legacy Network","brandPrimary":"Women Rise","brandSecondary":"Legacy Network","tagline":"Heal. Build. Lead. Leave a Legacy.","logoUrl":"/assets/brand/logo-mark.webp","supportEmail":"support@womenriselegacy.org","phone":"","address":"","footerDescription":"Empowering women, strengthening families, and building a global legacy through leadership, mentorship, enterprise, and humanitarian action.","facebook":"","instagram":"","linkedin":"","youtube":"","copyright":"Women Rise Legacy Network. All rights reserved.","footerNote":"Privacy-first community and humanitarian platform."}$wrljson$::jsonb,true),
('site.announcement','Announcement bar','announcement',$wrljson${"enabled":false,"text":"","linkLabel":"","linkUrl":""}$wrljson$::jsonb,true)
on conflict(content_key) do nothing;

insert into public.content_options(group_key,label,value,display_order) values
('mentor_expertise','Leadership','Leadership',10),('mentor_expertise','Entrepreneurship','Entrepreneurship',20),('mentor_expertise','Career Growth','Career Growth',30),('mentor_expertise','Wellbeing','Wellbeing',40),
('podcast_category','Leadership','leadership',10),('podcast_category','Legacy Stories','legacy-stories',20),
('donation_designation','General Donation','General Donation',10),('donation_designation','Education','Education',20),('donation_designation','Family Support','Family Support',30),
('item_category','Clothing','Clothing',10),('item_category','Shoes','Shoes',20),('item_category','School supplies','School supplies',30),('item_category','Hygiene products','Hygiene products',40),('item_category','Baby items','Baby items',50),('item_category','Toys','Toys',60),('item_category','Blankets','Blankets',70),('item_category','Other','Other',80),
('item_condition','New','New',10),('item_condition','Like new','Like new',20),('item_condition','Good reusable condition','Good reusable condition',30),
('shipping_preference','Ship to approved address','Ship to approved address',10),('shipping_preference','Local drop-off','Local drop-off',20),('shipping_preference','Need guidance','Need guidance',30),
('assistance_type','Family essentials','Family essentials',10),('assistance_type','School supplies','School supplies',20),('assistance_type','Baby items','Baby items',30),('assistance_type','Emergency relief','Emergency relief',40),('assistance_type','Housing or utilities','Housing or utilities',50),('assistance_type','Other','Other',60),
('organization_type','Nonprofit','Nonprofit',10),('organization_type','Company','Company',20),('organization_type','School or university','School or university',30),('organization_type','Community group','Community group',40),('organization_type','Government or public body','Government or public body',50),('organization_type','Other','Other',60)
on conflict(group_key,value) do nothing;

insert into public.email_templates(template_key,name,subject,html_body,text_body,available_variables) values
('membership_trial_started','Membership trial started','Your {{plan_name}} trial has started','<h1>Welcome, {{member_name}}</h1><p>Your {{plan_name}} trial is active.</p><p>Your trial ends on {{trial_end}}.</p><p><a href="{{dashboard_url}}">Open your dashboard</a></p>','Your {{plan_name}} trial is active until {{trial_end}}.',$wrljson$["member_name","plan_name","trial_end","dashboard_url"]$wrljson$::jsonb),
('membership_activated','Membership activated','Welcome to {{plan_name}} membership','<h1>Welcome, {{member_name}}</h1><p>Your {{plan_name}} membership is now active.</p><p>Billing: {{billing_cycle}} · Amount: {{amount}}</p>','Welcome {{member_name}}. Your {{plan_name}} membership is active.',$wrljson$["member_name","plan_name","billing_cycle","amount","expiry_date"]$wrljson$::jsonb),
('mentor_invitation','Mentor invitation','You are invited to mentor with Women Rise Legacy','<h1>Welcome, {{mentor_name}}</h1><p>You have been invited to join Women Rise Legacy as a mentor.</p>','You have been invited to join Women Rise Legacy as a mentor.',$wrljson$["mentor_name","invite_url"]$wrljson$::jsonb),
('mentor_match','Mentorship match confirmed','Your Women Rise Legacy mentorship match','<p>Hello {{member_name}}, you have been matched with {{mentor_name}}.</p>','You have been matched with {{mentor_name}}.',$wrljson$["member_name","mentor_name"]$wrljson$::jsonb),
('membership_renewed','Membership renewed','{{plan_name}} membership renewed','<h1>Membership renewed</h1><p>Hello {{member_name}}, your {{plan_name}} membership has renewed successfully.</p><p>Amount: {{amount}} · New expiry: {{expiry_date}}</p><p>Receipt: {{receipt_number}}</p>','Your {{plan_name}} membership renewed successfully. Amount: {{amount}}.',$wrljson$["member_name","plan_name","billing_cycle","amount","expiry_date","receipt_number","receipt_url"]$wrljson$::jsonb),
('membership_payment_failed','Membership payment failed','Membership payment needs attention','<h1>Payment needs attention</h1><p>Hello {{member_name}}, we could not confirm your latest membership payment.</p><p>Your grace period ends on {{grace_end}}. Open your dashboard to update or review billing.</p>','We could not confirm your membership payment. Review billing before {{grace_end}}.',$wrljson$["member_name","grace_end","dashboard_url"]$wrljson$::jsonb),
('membership_cancelled','Membership cancellation','Membership cancellation confirmed','<h1>Cancellation confirmed</h1><p>Hello {{member_name}}, your membership renewal has been cancelled.</p><p>Access remains available until {{expiry_date}}.</p>','Membership renewal cancelled. Access remains available until {{expiry_date}}.',$wrljson$["member_name","expiry_date"]$wrljson$::jsonb)
on conflict(template_key) do nothing;

-- Storage bucket for admin media uploads. Service role handles uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wrl-media','wrl-media',true,15728640,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','audio/mpeg','audio/mp4','audio/wav'])
on conflict(id) do update set public=true, file_size_limit=15728640;

-- Updated-at triggers.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['membership_plans','membership_payments','membership_subscriptions','membership_provider_prices','mentorship_matches','mentor_sessions','podcast_categories','podcast_guests','podcast_episodes','website_content','content_options','email_templates'] LOOP
    EXECUTE format('drop trigger if exists set_%s_updated_at on public.%I', t, t);
    EXECUTE format('create trigger set_%s_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- Indexes.
create index if not exists idx_membership_plans_public on public.membership_plans(is_active,display_order);
create index if not exists idx_membership_payments_user on public.membership_payments(user_id,created_at desc);
create index if not exists idx_membership_payments_provider on public.membership_payments(provider,provider_session_id,provider_subscription_id);
create index if not exists idx_membership_subscriptions_user on public.membership_subscriptions(user_id,status);
create index if not exists idx_mentorship_matches_participants on public.mentorship_matches(member_id,mentor_id,status);
create unique index if not exists idx_one_open_mentor_match on public.mentorship_matches(member_id,mentor_id) where status in ('pending_mentor','active','paused');
create index if not exists idx_mentor_sessions_schedule on public.mentor_sessions(match_id,scheduled_at);
create index if not exists idx_podcast_public on public.podcast_episodes(status,publish_at desc,is_featured);
create index if not exists idx_website_content_public on public.website_content(is_published,content_key);
create index if not exists idx_content_options_group on public.content_options(group_key,is_active,display_order);

-- RLS. Express service role performs writes; public policies expose only safe content.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['membership_plans','membership_payments','membership_subscriptions','membership_provider_prices','mentorship_matches','mentor_sessions','podcast_categories','podcast_guests','podcast_episodes','website_content','content_options','media_assets','email_templates'] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
  END LOOP;
END $$;

drop policy if exists "Active membership plans are public" on public.membership_plans;
create policy "Active membership plans are public" on public.membership_plans for select to anon,authenticated using (is_active=true);

drop policy if exists "Published podcast episodes are public" on public.podcast_episodes;
create policy "Published podcast episodes are public" on public.podcast_episodes for select to anon,authenticated using (status='published' and coalesce(publish_at,now())<=now());

drop policy if exists "Podcast categories are public" on public.podcast_categories;
create policy "Podcast categories are public" on public.podcast_categories for select to anon,authenticated using (is_active=true);

drop policy if exists "Podcast guests are public" on public.podcast_guests;
create policy "Podcast guests are public" on public.podcast_guests for select to anon,authenticated using (is_active=true);

drop policy if exists "Published website content is public" on public.website_content;
create policy "Published website content is public" on public.website_content for select to anon,authenticated using (is_published=true);

drop policy if exists "Active content options are public" on public.content_options;
create policy "Active content options are public" on public.content_options for select to anon,authenticated using (is_active=true);

drop policy if exists "Users read own membership payments" on public.membership_payments;
create policy "Users read own membership payments" on public.membership_payments for select to authenticated using (user_id=auth.uid());

drop policy if exists "Users read own subscriptions" on public.membership_subscriptions;
create policy "Users read own subscriptions" on public.membership_subscriptions for select to authenticated using (user_id=auth.uid());

-- Mentorship records contain administrator and mentor-private notes. Direct client access is denied;
-- participant-safe projections are returned only by authenticated backend routes.
drop policy if exists "Participants read mentorship matches" on public.mentorship_matches;
drop policy if exists "Participants read mentor sessions" on public.mentor_sessions;
