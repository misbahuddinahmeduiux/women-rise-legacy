import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { slugify } from '../lib/helpers.js';

export const adminRouter = Router();
adminRouter.use(requireUser, requireAdmin);

adminRouter.get('/overview', async (_req, res, next) => {
  try {
    const tables = ['profiles', 'current_needs', 'campaigns', 'sponsor_families', 'impact_reports', 'donations', 'assistance_requests', 'volunteer_applications', 'partner_applications', 'shipment_tracking', 'businesses', 'products_services', 'opportunities', 'resources', 'chapters', 'network_events', 'member_success_stories', 'membership_applications', 'mentor_requests'] as const;
    const results = await Promise.all(tables.map((table) => supabaseAdmin.from(table).select('*', { count: 'exact', head: true })));
    res.json(Object.fromEntries(tables.map((table, index) => [table, results[index]?.count ?? 0])));
  } catch (error) { next(error); }
});

const currentNeedSchema = z.object({
  title: z.string().min(3), slug: z.string().optional(), category: z.string().min(2), description: z.string().min(10), country: z.string().min(2), community: z.string().min(2), quantityNeeded: z.coerce.number().int().positive(), quantityReceived: z.coerce.number().int().min(0).default(0), urgency: z.enum(['urgent', 'high', 'normal']), deadline: z.string().optional().nullable(), partnerOrganization: z.string().optional().default(''), imageUrl: z.string().max(1000).optional().or(z.literal('')), wishlistUrl: z.string().url().optional().or(z.literal('')), donationInstructions: z.string().optional().default(''), status: z.enum(['open', 'partially_fulfilled', 'fulfilled', 'shipped', 'delivered', 'closed']).default('open'), isPublished: z.boolean().default(true)
});

const campaignSchema = z.object({
  title: z.string().min(3), slug: z.string().optional(), campaignType: z.string().min(2), country: z.string().min(2), summary: z.string().min(10), description: z.string().min(20), fundingGoal: z.coerce.number().positive(), amountRaised: z.coerce.number().min(0).default(0), itemsNeeded: z.string().optional().default(''), startDate: z.string().optional().nullable(), endDate: z.string().optional().nullable(), imageUrl: z.string().max(1000).optional().or(z.literal('')), status: z.enum(['draft', 'active', 'completed', 'closed']).default('active'), isPublished: z.boolean().default(true)
});

const familySchema = z.object({
  publicAlias: z.string().min(2), slug: z.string().optional(), familyReferenceId: z.string().min(2), country: z.string().min(2), generalLocation: z.string().min(2), familySize: z.coerce.number().int().positive(), situationSummary: z.string().min(20), assistanceRequired: z.string().min(5), sponsorshipGoal: z.coerce.number().positive(), amountRaised: z.coerce.number().min(0).default(0), monthlySupportAmount: z.coerce.number().positive(), imageUrl: z.string().max(1000).optional().or(z.literal('')), status: z.enum(['open', 'sponsored', 'completed', 'closed']).default('open'), isPublished: z.boolean().default(true)
});

const impactReportSchema = z.object({
  reportTitle: z.string().min(3),
  reportingPeriod: z.string().min(2),
  year: z.coerce.number().int().min(2000).max(2100),
  country: z.string().min(2),
  program: z.string().min(2),
  peopleSupported: z.coerce.number().int().min(0).default(0),
  itemsDistributed: z.coerce.number().int().min(0).default(0),
  fundsUsed: z.coerce.number().min(0).default(0),
  pdfUrl: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().max(1000).optional().or(z.literal('')),
  summary: z.string().min(20),
  isPublished: z.boolean().default(true)
});



const imageValue = z.string().max(1000).optional().default('');
const businessSchema = z.object({ name:z.string().min(2), slug:z.string().optional(), ownerName:z.string().min(2), description:z.string().min(20), industry:z.string().min(2), country:z.string().min(2), city:z.string().min(2), websiteUrl:z.string().url().or(z.literal('')).optional(), email:z.string().email().or(z.literal('')).optional(), phone:z.string().optional().default(''), logoUrl:imageValue, imageUrl:imageValue, virtualServices:z.boolean().default(false), isVerified:z.boolean().default(false), isFeatured:z.boolean().default(false), isPublished:z.boolean().default(true) });
const productSchema = z.object({ businessId:z.string().uuid().or(z.literal('')).optional(), title:z.string().min(2), slug:z.string().optional(), itemType:z.enum(['product','service']), description:z.string().min(10), price:z.coerce.number().min(0).optional().nullable(), currency:z.string().length(3).default('usd'), imageUrl:imageValue, externalPurchaseUrl:z.string().url().or(z.literal('')).optional(), contactUrl:z.string().url().or(z.string().email()).or(z.literal('')).optional(), category:z.string().min(2), isFeatured:z.boolean().default(false), isPublished:z.boolean().default(true) });
const opportunitySchema = z.object({ title:z.string().min(2), slug:z.string().optional(), opportunityType:z.string().min(2), organization:z.string().min(2), location:z.string().min(2), workMode:z.string().min(2), deadline:z.string().optional().nullable(), eligibility:z.string().min(5), description:z.string().min(10), applicationUrl:z.string().url().or(z.literal('')).optional(), contactEmail:z.string().email().or(z.literal('')).optional(), isFeatured:z.boolean().default(false), isPublished:z.boolean().default(true) });
const resourceSchema = z.object({ title:z.string().min(2), slug:z.string().optional(), description:z.string().min(10), resourceType:z.string().min(2), fileUrl:z.string().url().or(z.literal('')).optional(), externalUrl:z.string().url().or(z.literal('')).optional(), imageUrl:imageValue, membershipLevel:z.enum(['all','rise','legacy','elite']).default('all'), downloadInstructions:z.string().optional().default(''), isPublished:z.boolean().default(true) });
const chapterSchema = z.object({ name:z.string().min(2), slug:z.string().optional(), city:z.string().min(2), state:z.string().optional().default(''), country:z.string().min(2), leaderName:z.string().min(2), contactEmail:z.string().email().or(z.literal('')).optional(), imageUrl:imageValue, meetingSchedule:z.string().optional().default(''), description:z.string().min(10), status:z.enum(['forming','active','paused','closed']).default('active'), isPublished:z.boolean().default(true) });
const eventSchema = z.object({ title:z.string().min(2), slug:z.string().optional(), eventType:z.string().min(2), description:z.string().min(10), startAt:z.string().min(8), endAt:z.string().optional().nullable(), location:z.string().min(2), isVirtual:z.boolean().default(false), registrationUrl:z.string().url().or(z.literal('')).optional(), imageUrl:imageValue, capacity:z.coerce.number().int().positive().optional().nullable(), status:z.enum(['draft','upcoming','live','completed','cancelled']).default('upcoming'), isPublished:z.boolean().default(true) });
const memberStorySchema = z.object({ title:z.string().min(2), slug:z.string().optional(), memberName:z.string().min(2), achievement:z.string().min(2), story:z.string().min(20), imageUrl:imageValue, videoUrl:z.string().url().or(z.literal('')).optional(), publishDate:z.string().min(8), isPublished:z.boolean().default(true) });

function crudRoutes(path: string, table: string, schema: z.ZodTypeAny, mapInput: (input: any) => Record<string, unknown>) {
  adminRouter.get(`/${path}`, async (_req, res, next) => {
    try { const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: false }); if (error) throw error; res.json(data); } catch (error) { next(error); }
  });
  adminRouter.post(`/${path}`, async (req, res, next) => {
    try { const input = schema.parse(req.body); const payload = mapInput(input); const { data, error } = await supabaseAdmin.from(table).insert(payload).select().single(); if (error) throw error; res.status(201).json(data); } catch (error) { next(error); }
  });
  adminRouter.put(`/${path}/:id`, async (req, res, next) => {
    try { const input = schema.parse(req.body); const payload = { ...mapInput(input), updated_at: new Date().toISOString() }; const { data, error } = await supabaseAdmin.from(table).update(payload).eq('id', req.params.id).select().single(); if (error) throw error; res.json(data); } catch (error) { next(error); }
  });
  adminRouter.delete(`/${path}/:id`, async (req, res, next) => {
    try { const { error } = await supabaseAdmin.from(table).delete().eq('id', req.params.id); if (error) throw error; res.status(204).send(); } catch (error) { next(error); }
  });
}

crudRoutes('current-needs', 'current_needs', currentNeedSchema, (i) => ({ title: i.title, slug: i.slug || slugify(i.title), category: i.category, description: i.description, country: i.country, community: i.community, quantity_needed: i.quantityNeeded, quantity_received: i.quantityReceived, urgency: i.urgency, deadline: i.deadline || null, partner_organization: i.partnerOrganization || null, image_url: i.imageUrl || null, wishlist_url: i.wishlistUrl || null, donation_instructions: i.donationInstructions, status: i.status, is_published: i.isPublished }));
crudRoutes('campaigns', 'campaigns', campaignSchema, (i) => ({ title: i.title, slug: i.slug || slugify(i.title), campaign_type: i.campaignType, country: i.country, summary: i.summary, description: i.description, funding_goal: i.fundingGoal, amount_raised: i.amountRaised, items_needed: i.itemsNeeded, start_date: i.startDate || null, end_date: i.endDate || null, image_url: i.imageUrl || null, status: i.status, is_published: i.isPublished }));
crudRoutes('sponsor-families', 'sponsor_families', familySchema, (i) => ({ public_alias: i.publicAlias, slug: i.slug || slugify(i.publicAlias), family_reference_id: i.familyReferenceId, country: i.country, general_location: i.generalLocation, family_size: i.familySize, situation_summary: i.situationSummary, assistance_required: i.assistanceRequired, sponsorship_goal: i.sponsorshipGoal, amount_raised: i.amountRaised, monthly_support_amount: i.monthlySupportAmount, image_url: i.imageUrl || null, status: i.status, is_published: i.isPublished }));
crudRoutes('impact-reports', 'impact_reports', impactReportSchema, (i) => ({ report_title: i.reportTitle, reporting_period: i.reportingPeriod, year: i.year, country: i.country, program: i.program, people_supported: i.peopleSupported, items_distributed: i.itemsDistributed, funds_used: i.fundsUsed, pdf_url: i.pdfUrl || null, image_url: i.imageUrl || null, summary: i.summary, is_published: i.isPublished }));
crudRoutes('businesses','businesses',businessSchema,(i)=>({name:i.name,slug:i.slug||slugify(i.name),owner_name:i.ownerName,description:i.description,industry:i.industry,country:i.country,city:i.city,website_url:i.websiteUrl||null,email:i.email||null,phone:i.phone||null,logo_url:i.logoUrl||null,image_url:i.imageUrl||null,virtual_services:i.virtualServices,is_verified:i.isVerified,is_featured:i.isFeatured,is_published:i.isPublished}));
crudRoutes('products-services','products_services',productSchema,(i)=>({business_id:i.businessId||null,title:i.title,slug:i.slug||slugify(i.title),item_type:i.itemType,description:i.description,price:i.price??null,currency:i.currency.toLowerCase(),image_url:i.imageUrl||null,external_purchase_url:i.externalPurchaseUrl||null,contact_url:i.contactUrl?(i.contactUrl.includes('@')&&!i.contactUrl.startsWith('http')?`mailto:${i.contactUrl}`:i.contactUrl):null,category:i.category,is_featured:i.isFeatured,is_published:i.isPublished}));
crudRoutes('opportunities','opportunities',opportunitySchema,(i)=>({title:i.title,slug:i.slug||slugify(i.title),opportunity_type:i.opportunityType,organization:i.organization,location:i.location,work_mode:i.workMode,deadline:i.deadline||null,eligibility:i.eligibility,description:i.description,application_url:i.applicationUrl||null,contact_email:i.contactEmail||null,is_featured:i.isFeatured,is_published:i.isPublished}));
crudRoutes('resources','resources',resourceSchema,(i)=>({title:i.title,slug:i.slug||slugify(i.title),description:i.description,resource_type:i.resourceType,file_url:i.fileUrl||null,external_url:i.externalUrl||null,image_url:i.imageUrl||null,membership_level:i.membershipLevel,download_instructions:i.downloadInstructions||null,is_published:i.isPublished}));
crudRoutes('chapters','chapters',chapterSchema,(i)=>({name:i.name,slug:i.slug||slugify(i.name),city:i.city,state:i.state||null,country:i.country,leader_name:i.leaderName,contact_email:i.contactEmail||null,image_url:i.imageUrl||null,meeting_schedule:i.meetingSchedule||null,description:i.description,status:i.status,is_published:i.isPublished}));
crudRoutes('network-events','network_events',eventSchema,(i)=>({title:i.title,slug:i.slug||slugify(i.title),event_type:i.eventType,description:i.description,start_at:i.startAt,end_at:i.endAt||null,location:i.location,is_virtual:i.isVirtual,registration_url:i.registrationUrl||null,image_url:i.imageUrl||null,capacity:i.capacity??null,status:i.status,is_published:i.isPublished}));
crudRoutes('member-success-stories','member_success_stories',memberStorySchema,(i)=>({title:i.title,slug:i.slug||slugify(i.title),member_name:i.memberName,achievement:i.achievement,story:i.story,image_url:i.imageUrl||null,video_url:i.videoUrl||null,publish_date:i.publishDate,is_published:i.isPublished}));


adminRouter.get('/members', async (_req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('profiles').select('*').order('created_at',{ascending:false});if(error)throw error;res.json(data)}catch(error){next(error)}});
adminRouter.patch('/members/:id', async (req,res,next)=>{try{const input=z.object({membershipLevel:z.enum(['rise','legacy','elite']).nullable().optional(),membershipStatus:z.enum(['inactive','pending','active','paused','expired']).optional(),isDirectoryVisible:z.boolean().optional(),isMentor:z.boolean().optional(),mentorExpertise:z.array(z.string()).optional(),mentorAvailability:z.string().optional(),role:z.enum(['member','mentor','volunteer','partner_representative','chapter_leader','donation_manager','content_manager','admin']).optional()}).parse(req.body);const payload:any={};if(input.membershipLevel!==undefined)payload.membership_level=input.membershipLevel;if(input.membershipStatus!==undefined)payload.membership_status=input.membershipStatus;if(input.isDirectoryVisible!==undefined)payload.is_directory_visible=input.isDirectoryVisible;if(input.isMentor!==undefined)payload.is_mentor=input.isMentor;if(input.mentorExpertise!==undefined)payload.mentor_expertise=input.mentorExpertise;if(input.mentorAvailability!==undefined)payload.mentor_availability=input.mentorAvailability;if(input.role!==undefined)payload.role=input.role;const {data,error}=await supabaseAdmin.from('profiles').update(payload).eq('id',req.params.id).select().single();if(error)throw error;res.json(data)}catch(error){next(error)}});
adminRouter.get('/network-applications', async (_req,res,next)=>{try{const [memberships,mentors,events]=await Promise.all([supabaseAdmin.from('membership_applications').select('*').order('created_at',{ascending:false}),supabaseAdmin.from('mentor_requests').select('*,mentor:profiles!mentor_requests_mentor_id_fkey(full_name)').order('created_at',{ascending:false}),supabaseAdmin.from('event_registrations').select('*,event:network_events(title)').order('created_at',{ascending:false})]);res.json({membershipApplications:memberships.data??[],mentorRequests:mentors.data??[],eventRegistrations:events.data??[]})}catch(error){next(error)}});
adminRouter.patch('/network-applications/:type/:id/status', async (req,res,next)=>{try{const map:Record<string,string>={membership:'membership_applications',mentor:'mentor_requests',event:'event_registrations'};const table=map[req.params.type];if(!table)return res.status(400).json({error:'Unsupported application type.'});const status=(req.params.type==='membership'?z.enum(['new','under_review','approved','rejected','completed']):req.params.type==='mentor'?z.enum(['new','under_review','matched','approved','rejected','completed']):z.enum(['registered','waitlisted','attended','cancelled'])).parse(req.body.status);const {data,error}=await supabaseAdmin.from(table).update({status,updated_at:new Date().toISOString()}).eq('id',req.params.id).select().single();if(error)throw error;res.json(data)}catch(error){next(error)}});

adminRouter.get('/submissions', async (_req, res, next) => {
  try {
    const [contacts, items, assistance, volunteers, partners, shipments, donations] = await Promise.all([
      supabaseAdmin.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('item_donations').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('assistance_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('volunteer_applications').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('partner_applications').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('shipment_tracking').select('*').order('created_at', { ascending: false }).limit(100),
      supabaseAdmin.from('donations').select('*').order('created_at', { ascending: false }).limit(100)
    ]);
    res.json({ contacts: contacts.data ?? [], itemDonations: items.data ?? [], assistanceRequests: assistance.data ?? [], volunteers: volunteers.data ?? [], partners: partners.data ?? [], shipments: shipments.data ?? [], donations: donations.data ?? [] });
  } catch (error) { next(error); }
});

adminRouter.patch('/submissions/:type/:id/status', async (req, res, next) => {
  try {
    const typeMap: Record<string, string> = { contact: 'contact_messages', item: 'item_donations', assistance: 'assistance_requests', volunteer: 'volunteer_applications', partner: 'partner_applications', shipment: 'shipment_tracking' };
    const table = typeMap[req.params.type];
    if (!table) return res.status(400).json({ error: 'Unsupported submission type.' });
    const status = z.enum(['new', 'under_review', 'approved', 'rejected', 'completed']).parse(req.body.status);
    const { data, error } = await supabaseAdmin.from(table).update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) { next(error); }
});
