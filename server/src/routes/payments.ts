import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { optionalUser, requireUser } from '../middleware/auth.js';
import { queueDonationReceiptEmail } from '../lib/donationReceipts.js';
import { activateMembershipTrial, cancelMembershipByProviderSubscription, completeMembershipPayment, markMembershipPastDue, provisionMembershipSubscription, recordMembershipRenewal } from '../lib/memberships.js';
import {
  decryptCredentials,
  getGateway,
  getPayPalAccessToken,
  listPublicGateways,
  paypalBaseUrl,
  type PayPalCredentials,
  type PaymentProvider,
  type StripeCredentials
} from '../lib/paymentGateways.js';

export const paymentsRouter = Router();

const checkoutSchema = z.object({
  provider: z.enum(['stripe', 'paypal', 'bank_transfer', 'demo']).optional(),
  amount: z.coerce.number().min(1).max(100000),
  frequency: z.enum(['one_time', 'monthly']).default('one_time'),
  donorName: z.string().min(2).max(120),
  donorEmail: z.string().email(),
  campaignId: z.string().uuid().optional().nullable(),
  sponsorFamilyId: z.string().uuid().optional().nullable(),
  designation: z.string().max(160).optional().default('General Donation'),
  donorMessage: z.string().max(1000).optional().default(''),
  isAnonymous: z.boolean().optional().default(false)
});

paymentsRouter.get('/methods', async (_req, res, next) => {
  try {
    const methods = await listPublicGateways();
    if (!methods.length && env.PAYMENT_MODE === 'demo') {
      return res.json([{ provider: 'demo', displayName: 'Demo payment', mode: 'test', currency: env.STRIPE_CURRENCY, supportsRecurring: true, description: 'Local testing only. No real payment is charged.' }]);
    }
    res.json(methods);
  } catch (error) { next(error); }
});

paymentsRouter.post('/checkout', optionalUser, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    const provider = await resolveProvider(input.provider);

    if (input.frequency === 'monthly' && provider !== 'stripe' && provider !== 'demo') {
      return res.status(400).json({ error: 'Monthly donations are currently available through Stripe only.' });
    }

    if (provider === 'demo') return createDemoCheckout(req, res, input);
    if (provider === 'stripe') return createStripeCheckout(req, res, input);
    if (provider === 'paypal') return createPayPalCheckout(req, res, input);
    return createBankTransferCheckout(req, res, input);
  } catch (error) { next(error); }
});

paymentsRouter.post('/paypal/capture', optionalUser, async (req, res, next) => {
  try {
    const orderId = z.object({ orderId: z.string().min(8).max(255) }).parse(req.body).orderId;
    const gateway = await getGateway('paypal');
    const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
    const clientId = String(gateway.public_config?.clientId || '');
    const accessToken = await getPayPalAccessToken(gateway.mode, clientId, String(credentials.clientSecret || ''));
    const result = await capturePayPalDonation(orderId, gateway.mode, accessToken);
    if (!result) return res.status(404).json({ error: 'PayPal donation record was not found.' });
    res.json(result);
  } catch (error) { next(error); }
});

paymentsRouter.get('/manual/:reference', async (req, res, next) => {
  try {
    const reference = z.string().min(8).max(120).parse(req.params.reference);
    const gateway = await getGateway('bank_transfer');
    const { data, error } = await supabaseAdmin.from('donations')
      .select('provider_reference,amount,currency,designation,payment_status,created_at')
      .eq('provider_reference', reference).eq('payment_provider', 'bank_transfer').single();
    if (error || !data) return res.status(404).json({ error: 'Bank-transfer reference was not found.' });
    res.json({
      ...data,
      displayName: gateway.display_name,
      bankDetails: {
        bankName: String(gateway.public_config?.bankName || ''),
        accountName: String(gateway.public_config?.accountName || ''),
        accountNumber: String(gateway.public_config?.accountNumber || ''),
        routingNumber: String(gateway.public_config?.routingNumber || ''),
        iban: String(gateway.public_config?.iban || ''),
        swift: String(gateway.public_config?.swift || ''),
        instructions: String(gateway.settings?.instructions || 'Use your donation reference in the transfer memo.')
      }
    });
  } catch (error) { next(error); }
});

paymentsRouter.get('/session/:sessionId', async (req, res, next) => {
  try {
    const sessionId = z.string().min(8).max(255).parse(req.params.sessionId);
    const { data, error } = await supabaseAdmin.from('donations')
      .select('payment_status,receipt_number,receipt_token')
      .eq('payment_session_id', sessionId).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(202).json({ paymentStatus: 'processing', receiptToken: null });
    return res.json({ paymentStatus: data.payment_status, receiptNumber: data.receipt_number, receiptToken: data.receipt_token });
  } catch (error) { next(error); }
});

paymentsRouter.get('/receipt/:token', async (req, res, next) => {
  try {
    const token = z.string().uuid().parse(req.params.token);
    const { data, error } = await supabaseAdmin.from('donations')
      .select('receipt_number,receipt_token,donor_name,amount,currency,frequency,designation,payment_status,payment_provider,created_at,is_anonymous')
      .eq('receipt_token', token).eq('payment_status', 'paid').single();
    if (error || !data) return res.status(404).json({ error: 'Receipt not found.' });
    res.json({ ...data, donor_name: data.is_anonymous ? 'Anonymous donor' : data.donor_name, organization: env.APP_NAME });
  } catch (error) { next(error); }
});

paymentsRouter.get('/my-recurring', requireUser, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('recurring_donations').select('*').eq('user_id', req.user!.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

paymentsRouter.post('/recurring/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const { data: recurring, error } = await supabaseAdmin.from('recurring_donations').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).single();
    if (error || !recurring) return res.status(404).json({ error: 'Recurring donation not found.' });
    if (recurring.provider === 'stripe' && recurring.subscription_id) {
      const gateway = await getGateway('stripe');
      const credentials = decryptCredentials<StripeCredentials>(gateway.credentials_encrypted);
      const stripe = new Stripe(String(credentials.secretKey || ''));
      await stripe.subscriptions.cancel(recurring.subscription_id);
    }
    const { data, error: updateError } = await supabaseAdmin.from('recurring_donations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', recurring.id).select().single();
    if (updateError) throw updateError;
    res.json(data);
  } catch (error) { next(error); }
});

export async function stripeWebhook(req: Request, res: Response) {
  try {
    const gateway = await getGateway('stripe');
    const credentials = decryptCredentials<StripeCredentials>(gateway.credentials_encrypted);
    if (!credentials.secretKey || !credentials.webhookSecret) return res.status(503).json({ error: 'Stripe webhook is not configured.' });
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).send('Missing Stripe signature.');
    const stripe = new Stripe(String(credentials.secretKey));
    const event = stripe.webhooks.constructEvent(req.body, signature, String(credentials.webhookSecret));
    await recordGatewayEvent('stripe', event.id, event.type, { id: event.id, type: event.type, created: event.created, livemode: event.livemode, resourceId: (event.data.object as any)?.id || null });

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata ?? {};

      if (metadata.transactionType === 'membership' && metadata.membershipPaymentId) {
        await supabaseAdmin.from('membership_payments').update({
          provider_session_id: session.id,
          provider_payment_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          provider_subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          provider_payload: { customer: session.customer, mode: session.mode, paymentStatus: session.payment_status }
        }).eq('id', metadata.membershipPaymentId);
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        if (session.mode === 'subscription' && session.payment_status === 'no_payment_required' && subscriptionId) {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const trialEndUnix = Number(stripeSubscription.trial_end || stripeSubscription.current_period_end || 0);
          if (!trialEndUnix) throw new Error('Stripe did not return a trial end date.');
          await activateMembershipTrial({
            paymentId: metadata.membershipPaymentId,
            providerSubscriptionId: subscriptionId,
            providerCustomerId: typeof session.customer === 'string' ? session.customer : null,
            trialEnd: new Date(trialEndUnix * 1000),
            providerPayload: { stripeSessionId: session.id, mode: session.mode, paymentStatus: session.payment_status }
          });
        } else {
          await completeMembershipPayment({
            paymentId: metadata.membershipPaymentId,
            providerPaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
            providerSubscriptionId: subscriptionId,
            providerCustomerId: typeof session.customer === 'string' ? session.customer : null,
            providerPayload: { stripeSessionId: session.id, mode: session.mode, paymentStatus: session.payment_status }
          });
        }
      } else {
        const amount = Number(session.amount_total ?? 0) / 100;
        const donationPayload = {
          user_id: metadata.userId || null,
          donor_name: metadata.donorName || 'Anonymous',
          donor_email: metadata.donorEmail || session.customer_details?.email || '',
          amount,
          currency: session.currency || String(gateway.public_config?.currency || 'usd'),
          frequency: metadata.frequency || (session.mode === 'subscription' ? 'monthly' : 'one_time'),
          campaign_id: metadata.campaignId || null,
          sponsor_family_id: metadata.sponsorFamilyId || null,
          designation: metadata.designation || 'General Donation',
          donor_message: metadata.donorMessage || null,
          is_anonymous: metadata.isAnonymous === 'true',
          payment_provider: 'stripe',
          payment_session_id: session.id,
          payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          provider_reference: typeof session.payment_intent === 'string' ? session.payment_intent : session.id,
          subscription_id: typeof session.subscription === 'string' ? session.subscription : null,
          payment_status: 'paid',
          provider_payload: { customer: session.customer, mode: session.mode }
        };
        const { data, error } = await supabaseAdmin.from('donations').upsert(donationPayload, { onConflict: 'payment_session_id' }).select().single();
        if (error) throw error;
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          await supabaseAdmin.from('recurring_donations').upsert({
            donation_id: data.id, user_id: metadata.userId || null, donor_email: donationPayload.donor_email,
            provider: 'stripe', subscription_id: session.subscription, amount, currency: donationPayload.currency,
            interval: 'monthly', status: 'active'
          }, { onConflict: 'subscription_id' });
        }
        await queueDonationReceiptEmail(data);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.parent?.subscription_details?.subscription;
      if (subscriptionId) await markMembershipPastDue(subscriptionId);
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as any;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.parent?.subscription_details?.subscription;
      if (subscriptionId) {
        const line = invoice.lines?.data?.[0];
        const periodStart = line?.period?.start ? new Date(line.period.start * 1000) : new Date();
        const periodEnd = line?.period?.end ? new Date(line.period.end * 1000) : null;
        const amountPaid = Number(invoice.amount_paid || 0) / 100;
        const pendingPayment = await supabaseAdmin
          .from('membership_payments')
          .select('id')
          .eq('provider_subscription_id', subscriptionId)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pendingPayment.error) throw pendingPayment.error;

        if (pendingPayment.data && amountPaid > 0) {
          await completeMembershipPayment({
            paymentId: pendingPayment.data.id,
            providerPaymentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.id,
            providerSubscriptionId: subscriptionId,
            periodEnd,
            providerPayload: { stripeInvoiceId: invoice.id, billingReason: invoice.billing_reason, initialSubscriptionCharge: true }
          });
        } else {
          const subscriptionResult = await supabaseAdmin.from('membership_subscriptions').select('id,user_id').eq('provider_subscription_id', subscriptionId).maybeSingle();
          if (subscriptionResult.error) throw subscriptionResult.error;
          if (subscriptionResult.data) {
            if (invoice.billing_reason === 'subscription_cycle' && amountPaid > 0) {
              await recordMembershipRenewal({
                providerSubscriptionId: subscriptionId,
                providerPaymentId: typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.id,
                providerSessionId: invoice.id,
                amount: amountPaid,
                currency: String(invoice.currency || 'usd'),
                periodStart,
                periodEnd,
                providerPayload: { stripeInvoiceId: invoice.id, billingReason: invoice.billing_reason }
              });
            } else if (!pendingPayment.data) {
              await supabaseAdmin.from('membership_subscriptions').update({ status: 'active', current_period_start: periodStart.toISOString(), current_period_end: periodEnd?.toISOString() || null, expires_at: periodEnd?.toISOString() || null, grace_ends_at: null }).eq('id', subscriptionResult.data.id);
              await supabaseAdmin.from('profiles').update({ membership_status: 'active', membership_expires_at: periodEnd?.toISOString() || null }).eq('id', subscriptionResult.data.user_id);
            }
          }
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as any;
      const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
      const statusMap: Record<string, 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled'> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        unpaid: 'past_due',
        paused: 'paused',
        canceled: 'cancelled'
      };
      const membershipStatus = statusMap[String(subscription.status)] || 'paused';
      const updated = await supabaseAdmin.from('membership_subscriptions').update({
        status: membershipStatus,
        current_period_end: currentPeriodEnd,
        expires_at: currentPeriodEnd,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
      }).eq('provider_subscription_id', subscription.id).select('user_id').maybeSingle();
      if (updated.error) throw updated.error;
      if (updated.data) {
        await supabaseAdmin.from('profiles').update({ membership_status: membershipStatus, membership_expires_at: currentPeriodEnd }).eq('id', updated.data.user_id);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await supabaseAdmin.from('recurring_donations').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('subscription_id', subscription.id);
      await cancelMembershipByProviderSubscription(subscription.id, true);
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      if (typeof charge.payment_intent === 'string') {
        await supabaseAdmin.from('donations').update({ payment_status: 'refunded' }).eq('payment_intent_id', charge.payment_intent);
        await supabaseAdmin.from('membership_payments').update({ status: 'refunded' }).eq('provider_payment_id', charge.payment_intent);
      }
    }
    await markGatewayEventProcessed('stripe', event.id);
    res.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    res.status(400).send(message);
  }
}

async function createDemoCheckout(req: Request, res: Response, input: z.infer<typeof checkoutSchema>) {
  const reference = `demo_${Date.now()}`;
  const { data, error } = await supabaseAdmin.from('donations').insert(baseDonation(req, input, {
    currency: env.STRIPE_CURRENCY,
    payment_provider: 'demo',
    payment_session_id: reference,
    provider_reference: reference,
    payment_status: 'paid',
    provider_payload: { mode: 'demo' }
  })).select().single();
  if (error) throw error;
  await queueDonationReceiptEmail(data);
  return res.json({ url: `${env.CLIENT_URL}/donation-success?reference=${encodeURIComponent(reference)}&receipt=${data.receipt_token}`, demoMode: true });
}

async function createStripeCheckout(req: Request, res: Response, input: z.infer<typeof checkoutSchema>) {
  const gateway = await getGateway('stripe');
  const credentials = decryptCredentials<StripeCredentials>(gateway.credentials_encrypted);
  if (!credentials.secretKey) return res.status(503).json({ error: 'Stripe is connected without a usable secret key. Reconnect it in the admin panel.' });
  const stripe = new Stripe(String(credentials.secretKey));
  const currency = String(gateway.public_config?.currency || 'usd').toLowerCase();
  const session = await stripe.checkout.sessions.create({
    mode: input.frequency === 'monthly' ? 'subscription' : 'payment',
    customer_email: input.donorEmail,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: Math.round(input.amount * 100),
        recurring: input.frequency === 'monthly' ? { interval: 'month' } : undefined,
        product_data: { name: input.designation, description: `${env.APP_NAME} donation` }
      }
    }],
    success_url: `${env.CLIENT_URL}/donation-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/donate?cancelled=1`,
    metadata: {
      userId: req.user?.id || '', donorName: input.donorName, donorEmail: input.donorEmail,
      frequency: input.frequency, campaignId: input.campaignId || '', sponsorFamilyId: input.sponsorFamilyId || '',
      designation: input.designation, donorMessage: input.donorMessage.slice(0, 500), isAnonymous: String(input.isAnonymous)
    }
  });
  res.json({ url: session.url });
}

async function createPayPalCheckout(req: Request, res: Response, input: z.infer<typeof checkoutSchema>) {
  const gateway = await getGateway('paypal');
  const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
  const clientId = String(gateway.public_config?.clientId || '');
  const clientSecret = String(credentials.clientSecret || '');
  const accessToken = await getPayPalAccessToken(gateway.mode, clientId, clientSecret);
  const currency = String(gateway.public_config?.currency || 'usd').toUpperCase();
  const localReference = `paypal_pending_${crypto.randomUUID()}`;
  const { data: donation, error: donationError } = await supabaseAdmin.from('donations').insert(baseDonation(req, input, {
    currency: currency.toLowerCase(), payment_provider: 'paypal', payment_session_id: localReference,
    provider_reference: localReference, payment_status: 'pending', provider_payload: { mode: gateway.mode }
  })).select().single();
  if (donationError) throw donationError;

  const response = await fetch(`${paypalBaseUrl(gateway.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': donation.id,
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: donation.id,
        custom_id: donation.id,
        description: input.designation,
        amount: { currency_code: currency, value: Number(input.amount).toFixed(2) }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: env.APP_NAME,
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${env.CLIENT_URL}/donation-success?provider=paypal`,
            cancel_url: `${env.CLIENT_URL}/donate?cancelled=1`
          }
        }
      }
    })
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || !payload.id) {
    await supabaseAdmin.from('donations').update({ payment_status: 'failed', provider_payload: payload }).eq('id', donation.id);
    throw new Error(paypalError(payload, 'PayPal checkout could not be created.'));
  }
  const approvalUrl = payload.links?.find((link: any) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('PayPal did not return an approval URL.');
  await supabaseAdmin.from('donations').update({ payment_session_id: payload.id, provider_reference: payload.id, provider_payload: { mode: gateway.mode, status: payload.status } }).eq('id', donation.id);
  res.json({ url: approvalUrl });
}

async function createBankTransferCheckout(req: Request, res: Response, input: z.infer<typeof checkoutSchema>) {
  const gateway = await getGateway('bank_transfer');
  const currency = String(gateway.public_config?.currency || 'usd').toLowerCase();
  const reference = `WRL-BANK-${new Date().getFullYear()}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const sessionId = `bank_${crypto.randomUUID()}`;
  const { error } = await supabaseAdmin.from('donations').insert(baseDonation(req, input, {
    currency,
    payment_provider: 'bank_transfer',
    payment_session_id: sessionId,
    provider_reference: reference,
    payment_status: 'pending',
    provider_payload: { instructionsVersion: gateway.updated_at }
  }));
  if (error) throw error;
  res.json({ url: `${env.CLIENT_URL}/donation-success?provider=bank_transfer&reference=${encodeURIComponent(reference)}` });
}

function baseDonation(req: Request, input: z.infer<typeof checkoutSchema>, extra: Record<string, unknown>) {
  return {
    user_id: req.user?.id ?? null,
    donor_name: input.donorName,
    donor_email: input.donorEmail,
    amount: input.amount,
    frequency: input.frequency,
    campaign_id: input.campaignId || null,
    sponsor_family_id: input.sponsorFamilyId || null,
    designation: input.designation,
    donor_message: input.donorMessage || null,
    is_anonymous: input.isAnonymous,
    ...extra
  };
}

async function resolveProvider(requested?: string): Promise<PaymentProvider | 'demo'> {
  if (requested === 'demo') {
    if (env.PAYMENT_MODE !== 'demo') throw new Error('Demo payments are disabled.');
    return 'demo';
  }
  if (requested && ['stripe', 'paypal', 'bank_transfer'].includes(requested)) {
    await getGateway(requested as PaymentProvider);
    return requested as PaymentProvider;
  }
  const methods = await listPublicGateways();
  if (methods[0]) return methods[0].provider;
  if (env.PAYMENT_MODE === 'demo') return 'demo';
  throw new Error('No payment method is currently available.');
}

export async function paypalWebhook(req: Request, res: Response) {
  const event = req.body as any;
  try {
    const gateway = await getGateway('paypal');
    const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
    if (!credentials.webhookId) return res.status(503).json({ error: 'PayPal webhook ID is not configured.' });
    const clientId = String(gateway.public_config?.clientId || '');
    const accessToken = await getPayPalAccessToken(gateway.mode, clientId, String(credentials.clientSecret || ''));
    const verification = await fetch(`${paypalBaseUrl(gateway.mode)}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.header('paypal-auth-algo'),
        cert_url: req.header('paypal-cert-url'),
        transmission_id: req.header('paypal-transmission-id'),
        transmission_sig: req.header('paypal-transmission-sig'),
        transmission_time: req.header('paypal-transmission-time'),
        webhook_id: credentials.webhookId,
        webhook_event: event
      })
    });
    const verificationPayload = await verification.json().catch(() => ({})) as any;
    if (!verification.ok || verificationPayload.verification_status !== 'SUCCESS') return res.status(400).json({ error: 'Invalid PayPal webhook signature.' });
    await recordGatewayEvent('paypal', String(event.id || ''), String(event.event_type || 'unknown'), { id: event.id, eventType: event.event_type, resourceId: event.resource?.id || null, status: event.resource?.status || null });

    const resource = event.resource || {};
    const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.id;

    if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const paymentId = resource.custom_id;
      let payment = paymentId ? await supabaseAdmin.from('membership_payments').select('*,plan:membership_plans!membership_payments_plan_id_fkey(*)').eq('id', paymentId).maybeSingle() : null;
      if (!payment?.data && resource.id) payment = await supabaseAdmin.from('membership_payments').select('*,plan:membership_plans!membership_payments_plan_id_fkey(*)').eq('provider_subscription_id', resource.id).maybeSingle();
      if (payment?.data && resource.id) {
        const plan = payment.data.plan as any;
        const nextBillingTime = resource.billing_info?.next_billing_time ? new Date(resource.billing_info.next_billing_time) : null;
        if (Number(plan?.trial_days || 0) > 0) {
          const fallbackTrialEnd = new Date();
          fallbackTrialEnd.setUTCDate(fallbackTrialEnd.getUTCDate() + Number(plan.trial_days));
          await activateMembershipTrial({
            paymentId: payment.data.id,
            providerSubscriptionId: resource.id,
            trialEnd: nextBillingTime && !Number.isNaN(nextBillingTime.getTime()) ? nextBillingTime : fallbackTrialEnd,
            providerPayload: { paypalSubscriptionStatus: resource.status }
          });
        } else {
          await provisionMembershipSubscription({
            paymentId: payment.data.id,
            providerSubscriptionId: resource.id,
            periodEnd: nextBillingTime && !Number.isNaN(nextBillingTime.getTime()) ? nextBillingTime : undefined,
            providerPayload: { paypalSubscriptionStatus: resource.status }
          });
        }
      }
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' && resource.id) {
      await cancelMembershipByProviderSubscription(resource.id, false);
    }
    if (event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED' && resource.id) {
      await cancelMembershipByProviderSubscription(resource.id, true);
    }

    if (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED' && resource.id) {
      await markMembershipPastDue(resource.id);
    }
    if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED' && resource.id) {
      await markMembershipPastDue(resource.id);
    }

    if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = resource.billing_agreement_id || resource.billing_agreement?.id;
      if (subscriptionId && resource.id) {
        const pendingPayment = await supabaseAdmin
          .from('membership_payments')
          .select('id')
          .eq('provider_subscription_id', subscriptionId)
          .in('status', ['pending', 'processing'])
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (pendingPayment.error) throw pendingPayment.error;
        if (pendingPayment.data) {
          await completeMembershipPayment({
            paymentId: pendingPayment.data.id,
            providerSubscriptionId: subscriptionId,
            providerPaymentId: resource.id,
            providerPayload: { paypalSaleStatus: resource.state || resource.status, initialSubscriptionCharge: true }
          });
        } else {
          await recordMembershipRenewal({
            providerSubscriptionId: subscriptionId,
            providerPaymentId: resource.id,
            providerSessionId: `paypal-sale-${resource.id}`,
            amount: Number(resource.amount?.total || resource.amount?.value || 0),
            currency: String(resource.amount?.currency || resource.amount?.currency_code || 'usd'),
            providerPayload: { paypalSaleStatus: resource.state || resource.status }
          });
        }
      }
    }

    if (event.event_type === 'CHECKOUT.ORDER.APPROVED' && resource.id) {
      const membership = await supabaseAdmin.from('membership_payments').select('id').eq('provider_session_id', resource.id).maybeSingle();
      if (membership.data) await capturePayPalMembership(resource.id, membership.data.id, gateway.mode, accessToken);
      else await capturePayPalDonation(resource.id, gateway.mode, accessToken);
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED' && orderId) {
      const membership = await supabaseAdmin.from('membership_payments').select('*').eq('provider_session_id', orderId).maybeSingle();
      if (membership.data) {
        await completeMembershipPayment({ paymentId: membership.data.id, providerPaymentId: resource.id || orderId, providerPayload: { paypalCaptureStatus: resource.status } });
      } else {
        const { data, error } = await supabaseAdmin.from('donations').update({ payment_status: 'paid', payment_intent_id: resource.id || null, provider_reference: resource.id || orderId }).eq('payment_session_id', orderId).select().maybeSingle();
        if (error) throw error;
        if (data) await queueDonationReceiptEmail(data);
      }
    }

    if (event.event_type === 'PAYMENT.CAPTURE.DENIED' && orderId) {
      await supabaseAdmin.from('donations').update({ payment_status: 'failed' }).eq('payment_session_id', orderId);
      await supabaseAdmin.from('membership_payments').update({ status: 'failed' }).eq('provider_session_id', orderId);
    }

    if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = resource?.supplementary_data?.related_ids?.capture_id || resource?.links?.find((link: any) => link.rel === 'up')?.href?.split('/').pop();
      if (captureId) {
        await supabaseAdmin.from('donations').update({ payment_status: 'refunded' }).eq('payment_intent_id', captureId);
        await supabaseAdmin.from('membership_payments').update({ status: 'refunded' }).eq('provider_payment_id', captureId);
      }
    }

    await markGatewayEventProcessed('paypal', String(event.id || ''));
    res.json({ received: true });
  } catch (error) {
    if (event?.id) await supabaseAdmin.from('payment_gateway_events').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Webhook failed.' }).eq('provider', 'paypal').eq('external_event_id', event.id);
    res.status(400).json({ error: error instanceof Error ? error.message : 'PayPal webhook failed.' });
  }
}


async function capturePayPalMembership(orderId: string, paymentId: string, mode: 'test' | 'live', accessToken: string) {
  const paymentResult = await supabaseAdmin.from('membership_payments').select('*').eq('id', paymentId).single();
  if (paymentResult.error) throw paymentResult.error;
  if (paymentResult.data.status === 'paid') return paymentResult.data;
  const response = await fetch(`${paypalBaseUrl(mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': paymentId.slice(0, 38), Prefer: 'return=representation' },
    body: '{}'
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || payload.status !== 'COMPLETED') throw new Error(paypalError(payload, 'PayPal membership payment could not be captured.'));
  const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
  return completeMembershipPayment({ paymentId, providerPaymentId: capture?.id || orderId, providerPayload: { paypalOrderStatus: payload.status } });
}


async function capturePayPalDonation(orderId: string, mode: 'test' | 'live', accessToken: string) {
  const { data: existing, error: lookupError } = await supabaseAdmin.from('donations').select('*').eq('payment_session_id', orderId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) return null;
  if (existing.payment_status === 'paid') return { paymentStatus: 'paid', receiptToken: existing.receipt_token, receiptNumber: existing.receipt_number };

  const response = await fetch(`${paypalBaseUrl(mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': orderId.slice(0, 38),
      Prefer: 'return=representation'
    },
    body: '{}'
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || payload.status !== 'COMPLETED') throw new Error(paypalError(payload, 'PayPal payment could not be captured.'));
  const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
  const { data, error } = await supabaseAdmin.from('donations').update({
    payment_status: 'paid',
    payment_intent_id: capture?.id || null,
    provider_reference: capture?.id || orderId,
    provider_payload: { paypalOrderStatus: payload.status, payerId: payload.payer?.payer_id || null }
  }).eq('id', existing.id).select().single();
  if (error) throw error;
  await queueDonationReceiptEmail(data);
  return { paymentStatus: 'paid', receiptToken: data.receipt_token, receiptNumber: data.receipt_number };
}

async function recordGatewayEvent(provider: PaymentProvider, externalEventId: string, eventType: string, payload: Record<string, unknown>) {
  if (!externalEventId) return;
  await supabaseAdmin.from('payment_gateway_events').upsert({ provider, external_event_id: externalEventId, event_type: eventType, payload, status: 'received' }, { onConflict: 'provider,external_event_id' });
}

async function markGatewayEventProcessed(provider: PaymentProvider, externalEventId: string) {
  if (!externalEventId) return;
  await supabaseAdmin.from('payment_gateway_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('provider', provider).eq('external_event_id', externalEventId);
}

function paypalError(payload: any, fallback: string) {
  return payload?.details?.[0]?.description || payload?.message || payload?.error_description || fallback;
}
