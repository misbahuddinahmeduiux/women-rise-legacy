import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

export const publicRouter = Router();

publicRouter.get('/stats', async (_req, res, next) => {
  try {
    const [{ count: needs }, { count: campaigns }, { count: families }, { data: impact }, { count: members }, { count: businesses }] = await Promise.all([
      supabaseAdmin.from('current_needs').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('campaigns').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('sponsor_families').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('impact_stories').select('beneficiaries_count, items_distributed').eq('is_published', true),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_directory_visible', true).eq('membership_status', 'active'),
      supabaseAdmin.from('businesses').select('*', { count: 'exact', head: true }).eq('is_published', true)
    ]);
    const beneficiaries = (impact ?? []).reduce((sum: number, item: { beneficiaries_count?: number | null }) => sum + Number(item.beneficiaries_count ?? 0), 0);
    const itemsDistributed = (impact ?? []).reduce((sum: number, item: { items_distributed?: number | null }) => sum + Number(item.items_distributed ?? 0), 0);
    res.json({ activeNeeds: needs ?? 0, campaigns: campaigns ?? 0, families: families ?? 0, beneficiaries, itemsDistributed, members: members ?? 0, businesses: businesses ?? 0 });
  } catch (error) { next(error); }
});

publicRouter.get('/current-needs', async (req, res, next) => {
  try {
    let query = supabaseAdmin.from('current_needs').select('*').eq('is_published', true).order('created_at', { ascending: false });
    if (typeof req.query.country === 'string' && req.query.country) query = query.eq('country', req.query.country);
    if (typeof req.query.category === 'string' && req.query.category) query = query.eq('category', req.query.category);
    if (typeof req.query.urgency === 'string' && req.query.urgency) query = query.eq('urgency', req.query.urgency);
    const { data, error } = await query; if (error) throw error; res.json(data);
  } catch (error) { next(error); }
});
publicRouter.get('/current-needs/:slug', async (req, res, next) => { try { const { data, error } = await supabaseAdmin.from('current_needs').select('*').eq('slug', req.params.slug).eq('is_published', true).single(); if (error) return res.status(404).json({ error: 'Current need not found.' }); res.json(data); } catch (error) { next(error); } });
publicRouter.get('/campaigns', async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from('campaigns').select('*').eq('is_published', true).order('created_at', { ascending: false }); if (error) throw error; res.json(data); } catch (error) { next(error); } });
publicRouter.get('/campaigns/:slug', async (req, res, next) => { try { const { data, error } = await supabaseAdmin.from('campaigns').select('*').eq('slug', req.params.slug).eq('is_published', true).single(); if (error) return res.status(404).json({ error: 'Campaign not found.' }); res.json(data); } catch (error) { next(error); } });
publicRouter.get('/sponsor-families', async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from('sponsor_families').select('*').eq('is_published', true).order('created_at', { ascending: false }); if (error) throw error; res.json(data); } catch (error) { next(error); } });
publicRouter.get('/sponsor-families/:slug', async (req, res, next) => { try { const { data, error } = await supabaseAdmin.from('sponsor_families').select('*').eq('slug', req.params.slug).eq('is_published', true).single(); if (error) return res.status(404).json({ error: 'Family profile not found.' }); res.json(data); } catch (error) { next(error); } });
publicRouter.get('/impact-stories', async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from('impact_stories').select('*').eq('is_published', true).order('publish_date', { ascending: false }); if (error) throw error; res.json(data); } catch (error) { next(error); } });
publicRouter.get('/impact-reports', async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from('impact_reports').select('*').eq('is_published', true).order('year', { ascending: false }); if (error) throw error; res.json(data); } catch (error) { next(error); } });
publicRouter.get('/countries-served', async (_req, res, next) => { try { const { data, error } = await supabaseAdmin.from('countries_served').select('*').eq('is_active', true).order('country'); if (error) throw error; res.json(data); } catch (error) { next(error); } });

publicRouter.get('/members', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,role,country,city,avatar_url,headline,bio,skills,linkedin_url,website_url,membership_level,membership_status,is_directory_visible,is_mentor,mentor_expertise,mentor_availability,business_name,created_at').eq('is_directory_visible', true).eq('membership_status', 'active').order('full_name'); if (error) throw error; res.json(data); } catch (error) { next(error); }
});
publicRouter.get('/mentors', async (_req, res, next) => {
  try { const { data, error } = await supabaseAdmin.from('profiles').select('id,full_name,role,country,city,avatar_url,headline,bio,skills,linkedin_url,website_url,membership_level,membership_status,is_directory_visible,is_mentor,mentor_expertise,mentor_availability,business_name,created_at').eq('is_mentor', true).eq('membership_status', 'active').order('full_name'); if (error) throw error; res.json(data); } catch (error) { next(error); }
});
publicRouter.get('/businesses', async (req, res, next) => {
  try { let q=supabaseAdmin.from('businesses').select('*').eq('is_published',true).order('is_featured',{ascending:false}).order('name'); if(req.query.featured==='true')q=q.eq('is_featured',true); const {data,error}=await q; if(error)throw error; res.json(data); } catch(error){next(error)}
});
publicRouter.get('/businesses/:slug', async (req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('businesses').select('*').eq('slug',req.params.slug).eq('is_published',true).single();if(error)return res.status(404).json({error:'Business not found.'});res.json(data)}catch(error){next(error)}});
publicRouter.get('/products-services', async (req,res,next)=>{try{let businessId:string|undefined;if(typeof req.query.business==='string'&&req.query.business){const found=await supabaseAdmin.from('businesses').select('id').eq('slug',req.query.business).eq('is_published',true).maybeSingle();if(found.error)throw found.error;if(!found.data)return res.json([]);businessId=found.data.id;}let q=supabaseAdmin.from('products_services').select('*,businesses(name,slug)').eq('is_published',true).order('is_featured',{ascending:false}).order('title');if(businessId)q=q.eq('business_id',businessId);const {data,error}=await q;if(error)throw error;res.json((data??[]).map((item:any)=>({...item,business_name:item.businesses?.name??null,businesses:undefined})))}catch(error){next(error)}});
publicRouter.get('/opportunities', async (_req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('opportunities').select('*').eq('is_published',true).order('is_featured',{ascending:false}).order('deadline',{ascending:true,nullsFirst:false});if(error)throw error;res.json(data)}catch(error){next(error)}});
publicRouter.get('/resources', async (_req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('resources').select('*').eq('is_published',true).order('membership_level').order('title');if(error)throw error;res.json((data??[]).map((r:any)=>r.membership_level==='all'?r:{...r,file_url:null,external_url:null}))}catch(error){next(error)}});
publicRouter.get('/events', async (req,res,next)=>{try{let q=supabaseAdmin.from('network_events').select('*').eq('is_published',true).order('start_at',{ascending:true});if(req.query.upcoming==='true')q=q.gte('start_at',new Date().toISOString());const {data,error}=await q;if(error)throw error;res.json(data)}catch(error){next(error)}});
publicRouter.get('/chapters', async (_req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('chapters').select('*').eq('is_published',true).order('country').order('city');if(error)throw error;res.json(data)}catch(error){next(error)}});
publicRouter.get('/member-success-stories', async (_req,res,next)=>{try{const {data,error}=await supabaseAdmin.from('member_success_stories').select('*').eq('is_published',true).order('publish_date',{ascending:false});if(error)throw error;res.json(data)}catch(error){next(error)}});
