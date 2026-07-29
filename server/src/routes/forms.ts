import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import { queueEmail } from '../lib/email.js';

export const formsRouter = Router();

const email = z.string().email();
const baseContact = z.object({ fullName: z.string().min(2).max(120), email, phone: z.string().max(40).optional().default('') });

formsRouter.post('/contact', async (req, res, next) => {
  try {
    const input = baseContact.extend({ subject: z.string().min(2).max(160), message: z.string().min(10).max(5000) }).parse(req.body);
    const { error } = await supabaseAdmin.from('contact_messages').insert({ full_name: input.fullName, email: input.email, phone: input.phone, subject: input.subject, message: input.message });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'contact_received',subject:'We received your message',payload:{subject:input.subject}});
    res.status(201).json({ message: 'Your message has been received.' });
  } catch (error) { next(error); }
});

formsRouter.post('/donate-items', async (req, res, next) => {
  try {
    const input = baseContact.extend({ itemCategory: z.string().min(2), itemDescription: z.string().min(5).max(3000), quantity: z.coerce.number().int().positive(), condition: z.string().min(2), city: z.string().min(2), country: z.string().min(2), shippingPreference: z.string().min(2) }).parse(req.body);
    const { error } = await supabaseAdmin.from('item_donations').insert({ full_name: input.fullName, email: input.email, phone: input.phone, item_category: input.itemCategory, item_description: input.itemDescription, quantity: input.quantity, item_condition: input.condition, city: input.city, country: input.country, shipping_preference: input.shippingPreference });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'item_donation_received',subject:'Item donation submitted',payload:{category:input.itemCategory,quantity:input.quantity}});
    res.status(201).json({ message: 'Your item donation offer has been submitted for review.' });
  } catch (error) { next(error); }
});

formsRouter.post('/request-assistance', async (req, res, next) => {
  try {
    const input = baseContact.extend({ publicAlias: z.string().min(2).max(100), country: z.string().min(2), generalLocation: z.string().min(2), familySize: z.coerce.number().int().positive().max(50), assistanceType: z.string().min(2), situationSummary: z.string().min(20).max(5000), consentConfirmed: z.boolean() }).parse(req.body);
    const { error } = await supabaseAdmin.from('assistance_requests').insert({ full_name: input.fullName, public_alias: input.publicAlias, email: input.email, phone: input.phone, country: input.country, general_location: input.generalLocation, family_size: input.familySize, assistance_type: input.assistanceType, situation_summary: input.situationSummary, consent_confirmed: input.consentConfirmed });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'assistance_request_received',subject:'Private assistance request received',payload:{publicAlias:input.publicAlias,assistanceType:input.assistanceType}});
    res.status(201).json({ message: 'Your request has been submitted privately for verification.' });
  } catch (error) { next(error); }
});

formsRouter.post('/volunteer', async (req, res, next) => {
  try {
    const input = baseContact.extend({ country: z.string().min(2), city: z.string().min(2), skills: z.string().min(2).max(2000), availability: z.string().min(2), motivation: z.string().min(10).max(3000) }).parse(req.body);
    const { error } = await supabaseAdmin.from('volunteer_applications').insert({ full_name: input.fullName, email: input.email, phone: input.phone, country: input.country, city: input.city, skills: input.skills, availability: input.availability, motivation: input.motivation });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'volunteer_application_received',subject:'Volunteer application received',payload:{country:input.country,availability:input.availability}});
    res.status(201).json({ message: 'Volunteer application submitted successfully.' });
  } catch (error) { next(error); }
});

formsRouter.post('/partner', async (req, res, next) => {
  try {
    const input = baseContact.extend({ organizationName: z.string().min(2), organizationType: z.string().min(2), country: z.string().min(2), website: z.string().url().optional().or(z.literal('')), partnershipInterest: z.string().min(10).max(3000) }).parse(req.body);
    const { error } = await supabaseAdmin.from('partner_applications').insert({ contact_name: input.fullName, email: input.email, phone: input.phone, organization_name: input.organizationName, organization_type: input.organizationType, country: input.country, website: input.website || null, partnership_interest: input.partnershipInterest });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'partner_application_received',subject:'Partnership request received',payload:{organization:input.organizationName,country:input.country}});
    res.status(201).json({ message: 'Partnership request submitted successfully.' });
  } catch (error) { next(error); }
});


formsRouter.post('/shipment-tracking', async (req, res, next) => {
  try {
    const input = baseContact.extend({
      carrier: z.string().min(2).max(120),
      trackingNumber: z.string().min(3).max(160),
      shippedDate: z.string().min(8).max(20),
      currentNeedId: z.string().uuid().optional().nullable(),
      itemDonationId: z.string().uuid().optional().nullable(),
      notes: z.string().max(2000).optional().default('')
    }).parse(req.body);
    const { error } = await supabaseAdmin.from('shipment_tracking').insert({
      full_name: input.fullName,
      email: input.email,
      phone: input.phone,
      carrier: input.carrier,
      tracking_number: input.trackingNumber,
      shipped_date: input.shippedDate,
      current_need_id: input.currentNeedId || null,
      item_donation_id: input.itemDonationId || null,
      notes: input.notes
    });
    if (error) throw error;
    await queueEmail({to:input.email,name:input.fullName,templateKey:'shipment_received',subject:'Shipment details received',payload:{carrier:input.carrier,trackingNumber:input.trackingNumber}});
    res.status(201).json({ message: 'Shipment tracking details were submitted successfully.' });
  } catch (error) { next(error); }
});
