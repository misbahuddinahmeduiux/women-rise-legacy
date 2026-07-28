import type { Request, Response } from 'express';
import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';

export const paymentsRouter = Router();
const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const checkoutSchema = z.object({
  amount: z.coerce.number().min(1).max(100000),
  frequency: z.enum(['one_time', 'monthly']).default('one_time'),
  donorName: z.string().min(2).max(120),
  donorEmail: z.string().email(),
  campaignId: z.string().uuid().optional().nullable(),
  sponsorFamilyId: z.string().uuid().optional().nullable(),
  designation: z.string().max(160).optional().default('General Donation')
});

paymentsRouter.post('/checkout', async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    if (env.PAYMENT_MODE === 'demo') {
      const reference = `demo_${Date.now()}`;
      await supabaseAdmin.from('donations').insert({ donor_name: input.donorName, donor_email: input.donorEmail, amount: input.amount, currency: env.STRIPE_CURRENCY, frequency: input.frequency, campaign_id: input.campaignId || null, sponsor_family_id: input.sponsorFamilyId || null, designation: input.designation, payment_provider: 'demo', payment_session_id: reference, payment_status: 'paid' });
      return res.json({ url: `${env.CLIENT_URL}/donation-success?demo=1&reference=${reference}`, demoMode: true });
    }

    if (!stripe) return res.status(503).json({ error: 'Stripe mode is enabled but STRIPE_SECRET_KEY is missing.' });

    const session = await stripe.checkout.sessions.create({
      mode: input.frequency === 'monthly' ? 'subscription' : 'payment',
      customer_email: input.donorEmail,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY,
          unit_amount: Math.round(input.amount * 100),
          recurring: input.frequency === 'monthly' ? { interval: 'month' } : undefined,
          product_data: { name: input.designation, description: 'Women Rise Legacy Foundation donation' }
        }
      }],
      success_url: `${env.CLIENT_URL}/donation-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.CLIENT_URL}/donate?cancelled=1`,
      metadata: { donorName: input.donorName, donorEmail: input.donorEmail, frequency: input.frequency, campaignId: input.campaignId || '', sponsorFamilyId: input.sponsorFamilyId || '', designation: input.designation }
    });
    res.json({ url: session.url });
  } catch (error) { next(error); }
});

export async function stripeWebhook(req: Request, res: Response) {
  if (env.PAYMENT_MODE !== 'stripe' || !stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe webhook is not configured.' });
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Missing Stripe signature.');
  try {
    const event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata ?? {};
      const amount = Number(session.amount_total ?? 0) / 100;
      await supabaseAdmin.from('donations').upsert({ donor_name: metadata.donorName || 'Anonymous', donor_email: metadata.donorEmail || session.customer_details?.email || '', amount, currency: session.currency || env.STRIPE_CURRENCY, frequency: metadata.frequency || (session.mode === 'subscription' ? 'monthly' : 'one_time'), campaign_id: metadata.campaignId || null, sponsor_family_id: metadata.sponsorFamilyId || null, designation: metadata.designation || 'General Donation', payment_provider: 'stripe', payment_session_id: session.id, payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null, subscription_id: typeof session.subscription === 'string' ? session.subscription : null, payment_status: 'paid' }, { onConflict: 'payment_session_id' });
    }
    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    res.status(400).send(message);
  }
}
