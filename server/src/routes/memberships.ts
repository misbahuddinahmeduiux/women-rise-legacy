import crypto from 'node:crypto';
import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { cancelMembershipByProviderSubscription, completeMembershipPayment, priceForCycle, type BillingCycle, type MembershipPlanRow } from '../lib/memberships.js';
import { decryptCredentials, getGateway, getPayPalAccessToken, paypalBaseUrl, type PayPalCredentials, type StripeCredentials } from '../lib/paymentGateways.js';
import { requireUser } from '../middleware/auth.js';

export const membershipsRouter = Router();

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly', 'one_time']),
  provider: z.enum(['stripe', 'paypal', 'bank_transfer', 'demo'])
});

membershipsRouter.get('/plans', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .order('created_at');
    if (error) throw error;
    res.json(data ?? []);
  } catch (error) { next(error); }
});

membershipsRouter.get('/receipt/:token', async (req, res, next) => {
  try {
    const token = z.string().uuid().parse(req.params.token);
    const { data, error } = await supabaseAdmin
      .from('membership_payments')
      .select('id,amount,currency,status,billing_cycle,provider,receipt_number,paid_at,created_at,plan:membership_plans!membership_payments_plan_id_fkey(name,access_level),profile:profiles!membership_payments_user_id_fkey(full_name)')
      .eq('receipt_token', token)
      .eq('status', 'paid')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Membership receipt was not found.' });
    res.json(data);
  } catch (error) { next(error); }
});

membershipsRouter.post('/checkout', requireUser, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    const { data: plan, error } = await supabaseAdmin.from('membership_plans').select('*').eq('id', input.planId).eq('is_active', true).single();
    if (error || !plan) return res.status(404).json({ error: 'Membership plan was not found.' });
    const amount = priceForCycle(plan as MembershipPlanRow, input.billingCycle);
    const userResult = await supabaseAdmin.auth.admin.getUserById(req.user!.id);
    const email = userResult.data.user?.email;
    if (!email) return res.status(400).json({ error: 'Your account email is unavailable.' });

    if (input.provider === 'demo') {
      if (env.PAYMENT_MODE !== 'demo') return res.status(400).json({ error: 'Demo membership checkout is disabled.' });
      const payment = await createPendingPayment(req.user!.id, plan, input.billingCycle, input.provider, amount, `demo_membership_${crypto.randomUUID()}`);
      await completeMembershipPayment({ paymentId: payment.id, providerPaymentId: payment.provider_session_id, providerPayload: { mode: 'demo' } });
      return res.json({ url: `${env.CLIENT_URL}/membership-success?payment_id=${payment.id}`, demoMode: true });
    }

    if (input.provider === 'stripe') return await stripeMembershipCheckout(res, req.user!.id, email, plan as MembershipPlanRow, input.billingCycle, amount);
    if (input.provider === 'paypal') return await paypalMembershipCheckout(res, req.user!.id, email, plan as MembershipPlanRow, input.billingCycle, amount);
    return await bankMembershipCheckout(res, req.user!.id, plan as MembershipPlanRow, input.billingCycle, amount);
  } catch (error) { next(error); }
});

membershipsRouter.post('/paypal/capture', requireUser, async (req, res, next) => {
  try {
    const orderId = z.object({ orderId: z.string().min(8).max(255) }).parse(req.body).orderId;
    const gateway = await getGateway('paypal');
    const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
    const accessToken = await getPayPalAccessToken(gateway.mode, String(gateway.public_config?.clientId || ''), String(credentials.clientSecret || ''));
    const paymentResult = await supabaseAdmin.from('membership_payments').select('*').eq('provider_session_id', orderId).eq('user_id', req.user!.id).single();
    if (paymentResult.error || !paymentResult.data) return res.status(404).json({ error: 'Membership payment was not found.' });
    if (paymentResult.data.status === 'paid') return res.json(paymentResult.data);

    const response = await fetch(`${paypalBaseUrl(gateway.mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': paymentResult.data.id.slice(0, 38), Prefer: 'return=representation' },
      body: '{}'
    });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok || payload.status !== 'COMPLETED') throw new Error(paypalError(payload, 'PayPal membership payment could not be captured.'));
    const capture = payload.purchase_units?.[0]?.payments?.captures?.[0];
    const completed = await completeMembershipPayment({ paymentId: paymentResult.data.id, providerPaymentId: capture?.id || orderId, providerPayload: { paypalOrderStatus: payload.status } });
    res.json(completed);
  } catch (error) { next(error); }
});

membershipsRouter.get('/manual/:id', requireUser, async (req, res, next) => {
  try {
    const { data: payment, error } = await supabaseAdmin
      .from('membership_payments')
      .select('id,amount,currency,status,provider_session_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .eq('provider', 'bank_transfer')
      .single();
    if (error || !payment) return res.status(404).json({ error: 'Bank-transfer membership payment was not found.' });
    const gateway = await getGateway('bank_transfer');
    res.json({
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      reference: payment.provider_session_id,
      displayName: gateway.display_name,
      bankDetails: {
        bankName: String(gateway.public_config?.bankName || ''),
        accountName: String(gateway.public_config?.accountName || ''),
        accountNumber: String(gateway.public_config?.accountNumber || ''),
        routingNumber: String(gateway.public_config?.routingNumber || ''),
        iban: String(gateway.public_config?.iban || ''),
        swift: String(gateway.public_config?.swift || ''),
        instructions: String(gateway.settings?.instructions || 'Use your membership transfer reference in the payment memo.')
      }
    });
  } catch (error) { next(error); }
});

membershipsRouter.get('/payment/:id', requireUser, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_payments')
      .select('*,plan:membership_plans!membership_payments_plan_id_fkey(name,slug,access_level)')
      .eq('id', req.params.id)
      .eq('user_id', req.user!.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Membership payment was not found.' });
    res.json(data);
  } catch (error) { next(error); }
});

membershipsRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    const [profile, subscriptions, payments] = await Promise.all([
      supabaseAdmin.from('profiles').select('*,plan:membership_plans!profiles_membership_plan_id_fkey(*)').eq('id', req.user!.id).single(),
      supabaseAdmin.from('membership_subscriptions').select('*,plan:membership_plans!membership_subscriptions_plan_id_fkey(name,slug,access_level)').eq('user_id', req.user!.id).order('created_at', { ascending: false }),
      supabaseAdmin.from('membership_payments').select('*,plan:membership_plans!membership_payments_plan_id_fkey(name,slug,access_level)').eq('user_id', req.user!.id).order('created_at', { ascending: false })
    ]);
    if (profile.error) throw profile.error;
    res.json({ profile: profile.data, subscriptions: subscriptions.data ?? [], payments: payments.data ?? [] });
  } catch (error) { next(error); }
});

membershipsRouter.post('/subscriptions/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const { data: subscription, error } = await supabaseAdmin.from('membership_subscriptions').select('*').eq('id', req.params.id).eq('user_id', req.user!.id).single();
    if (error || !subscription) return res.status(404).json({ error: 'Membership subscription was not found.' });
    if (subscription.provider === 'stripe' && subscription.provider_subscription_id) {
      const gateway = await getGateway('stripe');
      const credentials = decryptCredentials<StripeCredentials>(gateway.credentials_encrypted);
      const stripe = new Stripe(String(credentials.secretKey || ''));
      await stripe.subscriptions.update(subscription.provider_subscription_id, { cancel_at_period_end: true });
    }
    if (subscription.provider === 'paypal' && subscription.provider_subscription_id) {
      const gateway = await getGateway('paypal');
      const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
      const accessToken = await getPayPalAccessToken(gateway.mode, String(gateway.public_config?.clientId || ''), String(credentials.clientSecret || ''));
      const response = await fetch(`${paypalBaseUrl(gateway.mode)}/v1/billing/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}/cancel`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Cancelled by member.' })
      });
      if (!response.ok && response.status !== 204) throw new Error('PayPal could not cancel the subscription.');
    }
    if (subscription.provider_subscription_id) {
      await cancelMembershipByProviderSubscription(subscription.provider_subscription_id, false);
    } else {
      const update = await supabaseAdmin.from('membership_subscriptions').update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString() }).eq('id', subscription.id).select().single();
      if (update.error) throw update.error;
    }
    const refreshed = await supabaseAdmin.from('membership_subscriptions').select('*').eq('id', subscription.id).single();
    if (refreshed.error) throw refreshed.error;
    res.json(refreshed.data);
  } catch (error) { next(error); }
});

async function createPendingPayment(userId: string, plan: MembershipPlanRow, billingCycle: BillingCycle, provider: string, amount: number, providerSessionId: string) {
  const { data, error } = await supabaseAdmin.from('membership_payments').insert({
    user_id: userId,
    plan_id: plan.id,
    billing_cycle: billingCycle,
    provider,
    amount,
    currency: plan.currency,
    status: 'pending',
    provider_session_id: providerSessionId
  }).select().single();
  if (error) throw error;
  return data;
}

async function stripeMembershipCheckout(res: any, userId: string, email: string, plan: MembershipPlanRow, cycle: BillingCycle, amount: number) {
  const gateway = await getGateway('stripe');
  const credentials = decryptCredentials<StripeCredentials>(gateway.credentials_encrypted);
  if (!credentials.secretKey) return res.status(503).json({ error: 'Stripe is not fully configured.' });
  const stripe = new Stripe(String(credentials.secretKey));
  const localReference = `stripe_membership_${crypto.randomUUID()}`;
  const payment = await createPendingPayment(userId, plan, cycle, 'stripe', amount, localReference);
  const recurring = cycle !== 'one_time' && plan.auto_renew;
  const session = await stripe.checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    customer_email: email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: plan.currency.toLowerCase(),
        unit_amount: Math.round(amount * 100),
        recurring: recurring ? { interval: cycle === 'yearly' ? 'year' : 'month' } : undefined,
        product_data: { name: `${plan.name} membership`, description: plan.description.slice(0, 500) }
      }
    }],
    subscription_data: recurring && plan.trial_days > 0 ? { trial_period_days: plan.trial_days, metadata: { transactionType: 'membership', membershipPaymentId: payment.id, userId, planId: plan.id, billingCycle: cycle } } : recurring ? { metadata: { transactionType: 'membership', membershipPaymentId: payment.id, userId, planId: plan.id, billingCycle: cycle } } : undefined,
    success_url: `${env.CLIENT_URL}/membership-success?session_id={CHECKOUT_SESSION_ID}&payment_id=${payment.id}`,
    cancel_url: `${env.CLIENT_URL}/membership?cancelled=1`,
    metadata: { transactionType: 'membership', membershipPaymentId: payment.id, userId, planId: plan.id, billingCycle: cycle }
  });
  await supabaseAdmin.from('membership_payments').update({ provider_session_id: session.id, provider_payload: { mode: gateway.mode } }).eq('id', payment.id);
  res.json({ url: session.url, paymentId: payment.id });
}

async function paypalMembershipCheckout(res: any, userId: string, email: string, plan: MembershipPlanRow, cycle: BillingCycle, amount: number) {
  const gateway = await getGateway('paypal');
  const credentials = decryptCredentials<PayPalCredentials>(gateway.credentials_encrypted);
  const accessToken = await getPayPalAccessToken(gateway.mode, String(gateway.public_config?.clientId || ''), String(credentials.clientSecret || ''));
  const localReference = `paypal_membership_${crypto.randomUUID()}`;
  const payment = await createPendingPayment(userId, plan, cycle, 'paypal', amount, localReference);

  if (cycle !== 'one_time' && plan.auto_renew) {
    const paypalPlanId = await ensurePayPalBillingPlan(plan, cycle, gateway.mode, accessToken, amount);
    const response = await fetch(`${paypalBaseUrl(gateway.mode)}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': payment.id, Prefer: 'return=representation' },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        custom_id: payment.id,
        subscriber: { email_address: email },
        application_context: {
          brand_name: env.APP_NAME,
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${env.CLIENT_URL}/membership-success?provider=paypal-subscription&payment_id=${payment.id}`,
          cancel_url: `${env.CLIENT_URL}/membership?cancelled=1`
        }
      })
    });
    const payload = await response.json().catch(() => ({})) as any;
    if (!response.ok || !payload.id) throw new Error(paypalError(payload, 'PayPal subscription could not be created.'));
    const approvalUrl = payload.links?.find((link: any) => link.rel === 'approve')?.href;
    if (!approvalUrl) throw new Error('PayPal did not return a subscription approval URL.');
    await supabaseAdmin.from('membership_payments').update({ provider_session_id: payload.id, provider_subscription_id: payload.id, provider_payload: { mode: gateway.mode, type: 'subscription', status: payload.status } }).eq('id', payment.id);
    return res.json({ url: approvalUrl, paymentId: payment.id });
  }

  const response = await fetch(`${paypalBaseUrl(gateway.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': payment.id, Prefer: 'return=representation' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: payment.id, custom_id: payment.id, description: `${plan.name} membership`, amount: { currency_code: plan.currency.toUpperCase(), value: amount.toFixed(2) } }],
      payment_source: { paypal: { experience_context: { brand_name: env.APP_NAME, landing_page: 'LOGIN', user_action: 'PAY_NOW', return_url: `${env.CLIENT_URL}/membership-success?provider=paypal&payment_id=${payment.id}`, cancel_url: `${env.CLIENT_URL}/membership?cancelled=1` } } }
    })
  });
  const payload = await response.json().catch(() => ({})) as any;
  if (!response.ok || !payload.id) throw new Error(paypalError(payload, 'PayPal membership checkout could not be created.'));
  const approvalUrl = payload.links?.find((link: any) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('PayPal did not return an approval URL.');
  await supabaseAdmin.from('membership_payments').update({ provider_session_id: payload.id, provider_payload: { mode: gateway.mode, type: 'order', status: payload.status } }).eq('id', payment.id);
  res.json({ url: approvalUrl, paymentId: payment.id });
}

async function ensurePayPalBillingPlan(plan: MembershipPlanRow, cycle: 'monthly' | 'yearly', mode: 'test' | 'live', accessToken: string, amount: number) {
  const existing = await supabaseAdmin.from('membership_provider_prices').select('*').eq('plan_id', plan.id).eq('provider', 'paypal').eq('provider_mode', mode).eq('billing_cycle', cycle).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.external_price_id) return existing.data.external_price_id;

  const productResponse = await fetch(`${paypalBaseUrl(mode)}/v1/catalogs/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `${plan.id}-${mode}`.slice(0, 38), Prefer: 'return=representation' },
    body: JSON.stringify({ name: `${plan.name} membership`, description: plan.description.slice(0, 250), type: 'SERVICE', category: 'PROFESSIONAL_SERVICES' })
  });
  const product = await productResponse.json().catch(() => ({})) as any;
  if (!productResponse.ok || !product.id) throw new Error(paypalError(product, 'PayPal product could not be created.'));

  const planResponse = await fetch(`${paypalBaseUrl(mode)}/v1/billing/plans`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': `${plan.id}-${cycle}-${mode}`.slice(0, 38), Prefer: 'return=representation' },
    body: JSON.stringify({
      product_id: product.id,
      name: `${plan.name} ${cycle} membership`,
      description: plan.description.slice(0, 250),
      status: 'ACTIVE',
      billing_cycles: [
        ...(plan.trial_days > 0 ? [{
          frequency: { interval_unit: 'DAY', interval_count: plan.trial_days },
          tenure_type: 'TRIAL',
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: { fixed_price: { value: '0.00', currency_code: plan.currency.toUpperCase() } }
        }] : []),
        {
          frequency: { interval_unit: cycle === 'yearly' ? 'YEAR' : 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: plan.trial_days > 0 ? 2 : 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: amount.toFixed(2), currency_code: plan.currency.toUpperCase() } }
        }
      ],
      payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: plan.grace_period_days > 0 ? 3 : 1 }
    })
  });
  const paypalPlan = await planResponse.json().catch(() => ({})) as any;
  if (!planResponse.ok || !paypalPlan.id) throw new Error(paypalError(paypalPlan, 'PayPal billing plan could not be created.'));
  const saved = await supabaseAdmin.from('membership_provider_prices').upsert({ plan_id: plan.id, provider: 'paypal', provider_mode: mode, billing_cycle: cycle, external_product_id: product.id, external_price_id: paypalPlan.id }, { onConflict: 'plan_id,provider,provider_mode,billing_cycle' }).select().single();
  if (saved.error) throw saved.error;
  return paypalPlan.id;
}

async function bankMembershipCheckout(res: any, userId: string, plan: MembershipPlanRow, cycle: BillingCycle, amount: number) {
  const gateway = await getGateway('bank_transfer');
  const reference = `WRL-M-BANK-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const payment = await createPendingPayment(userId, plan, cycle, 'bank_transfer', amount, reference);
  await supabaseAdmin.from('membership_payments').update({ provider_payload: { instructionsVersion: gateway.updated_at } }).eq('id', payment.id);
  res.json({ url: `${env.CLIENT_URL}/membership-success?provider=bank_transfer&payment_id=${payment.id}&reference=${encodeURIComponent(reference)}`, paymentId: payment.id });
}

function paypalError(payload: any, fallback: string) {
  return payload?.details?.[0]?.description || payload?.message || payload?.error_description || fallback;
}
