begin;

revoke insert, update, delete, truncate, references, trigger
on table public.profiles
from anon, authenticated;

grant update (
  full_name,
  phone,
  country,
  city,
  avatar_url,
  headline,
  bio,
  skills,
  linkedin_url,
  website_url,
  business_name,
  timezone,
  languages
)
on table public.profiles
to authenticated;

commit;