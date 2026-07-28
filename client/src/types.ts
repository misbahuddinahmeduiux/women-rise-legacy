export interface CurrentNeed {
  id: string; title: string; slug: string; category: string; description: string; country: string; community: string; quantity_needed: number; quantity_received: number; urgency: 'urgent' | 'high' | 'normal'; deadline: string | null; partner_organization: string | null; image_url: string | null; wishlist_url: string | null; donation_instructions: string | null; status: string; is_published: boolean; created_at: string;
}
export interface Campaign {
  id: string; title: string; slug: string; campaign_type: string; country: string; summary: string; description: string; funding_goal: number; amount_raised: number; items_needed: string | null; start_date: string | null; end_date: string | null; image_url: string | null; status: string; is_published: boolean;
}
export interface SponsorFamily {
  id: string; public_alias: string; slug: string; family_reference_id: string; country: string; general_location: string; family_size: number; situation_summary: string; assistance_required: string; sponsorship_goal: number; amount_raised: number; monthly_support_amount: number; image_url: string | null; status: string; is_published: boolean;
}
export interface ImpactStory { id: string; title: string; country: string; community: string; story: string; beneficiaries_count: number; items_distributed: number; image_url: string | null; publish_date: string; }
export interface ImpactReport { id: string; report_title: string; reporting_period: string; year: number; country: string; program: string; people_supported: number; items_distributed: number; funds_used: number; pdf_url: string | null; image_url: string | null; summary: string; is_published: boolean; }
export interface CountryServed { id: string; country: string; latitude: number | null; longitude: number | null; communities_count: number; description: string | null; is_active: boolean; }

export type MembershipLevel = 'rise' | 'legacy' | 'elite';
export interface MemberProfile {
  id: string; full_name: string | null; role: string; phone: string | null; country: string | null; city: string | null; avatar_url: string | null;
  headline: string | null; bio: string | null; skills: string[] | null; linkedin_url: string | null; website_url: string | null;
  membership_level: MembershipLevel | null; membership_status: string; is_directory_visible: boolean; is_mentor: boolean;
  mentor_expertise: string[] | null; mentor_availability: string | null; business_name: string | null; created_at: string;
}
export interface Business {
  id: string; name: string; slug: string; owner_name: string; description: string; industry: string; country: string; city: string; website_url: string | null; email: string | null; phone: string | null; logo_url: string | null; image_url: string | null; virtual_services: boolean; is_verified: boolean; is_featured: boolean; is_published: boolean;
}
export interface ProductService {
  id: string; title: string; slug: string; business_id: string | null; business_name?: string; item_type: 'product' | 'service'; description: string; price: number | null; currency: string; image_url: string | null; external_purchase_url: string | null; contact_url: string | null; category: string; is_featured: boolean; is_published: boolean;
}
export interface Opportunity {
  id: string; title: string; slug: string; opportunity_type: string; organization: string; location: string; work_mode: string; deadline: string | null; eligibility: string; description: string; application_url: string | null; contact_email: string | null; is_featured: boolean; is_published: boolean;
}
export interface ResourceItem {
  id: string; title: string; slug: string; description: string; resource_type: string; file_url: string | null; external_url: string | null; image_url: string | null; membership_level: MembershipLevel | 'all'; download_instructions: string | null; is_published: boolean;
}
export interface Chapter {
  id: string; name: string; slug: string; city: string; state: string | null; country: string; leader_name: string; contact_email: string | null; image_url: string | null; meeting_schedule: string | null; description: string; status: string; is_published: boolean;
}
export interface NetworkEvent {
  id: string; title: string; slug: string; event_type: string; description: string; start_at: string; end_at: string | null; location: string; is_virtual: boolean; registration_url: string | null; image_url: string | null; capacity: number | null; status: string; is_published: boolean;
}
export interface MemberSuccessStory {
  id: string; title: string; slug: string; member_name: string; achievement: string; story: string; image_url: string | null; video_url: string | null; publish_date: string; is_published: boolean;
}
export interface MentorRequest {
  id: string; requester_id: string | null; mentor_id: string | null; requester_name: string; requester_email: string; goals: string; preferred_topics: string; availability: string; status: string; created_at: string;
}
export interface MembershipApplication {
  id: string; user_id: string | null; full_name: string; email: string; requested_level: MembershipLevel; professional_goal: string; community_interest: string; status: string; created_at: string;
}
