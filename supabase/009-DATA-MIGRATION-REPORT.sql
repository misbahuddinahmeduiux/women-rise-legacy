-- Read-only report after migration 009.
select 'legacy_mentor_review_required' as category,count(*) as records
from public.security_migration_review where entity_type='mentor_profile' and resolved_at is null
union all
select 'approved_active_public_mentors',count(*) from public.mentor_profiles where profile_status='approved' and is_active=true and directory_visible=true
union all
select 'pending_mentor_profiles',count(*) from public.mentor_profiles where profile_status='pending_approval'
union all
select 'active_staff',count(*) from public.staff_memberships where status='active'
union all
select 'invited_staff',count(*) from public.staff_memberships where status='invited'
union all
select 'invalid_legacy_mentor_flags',count(*) from public.profiles where role='mentor' or coalesce(is_mentor,false)=true;

select entity_type,entity_id,issue,snapshot,created_at
from public.security_migration_review
where resolved_at is null
order by created_at;
