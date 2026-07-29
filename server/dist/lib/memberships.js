import { env } from '../config/env.js';
import { queueEmail } from './email.js';
import { supabaseAdmin } from './supabase.js';
export function priceForCycle(plan, cycle) {
    if (cycle === 'monthly') {
        if (!plan.monthly_enabled || plan.monthly_price == null)
            throw new Error('Monthly billing is not enabled for this plan.');
        return Number(plan.monthly_price);
    }
    if (cycle === 'yearly') {
        if (!plan.yearly_enabled || plan.yearly_price == null)
            throw new Error('Yearly billing is not enabled for this plan.');
        return Number(plan.yearly_price);
    }
    if (!plan.one_time_enabled || plan.one_time_price == null)
        throw new Error('One-time billing is not enabled for this plan.');
    return Number(plan.one_time_price);
}
export function periodEndForPlan(plan, cycle, start = new Date()) {
    if (cycle === 'one_time' && plan.one_time_lifetime)
        return null;
    const result = new Date(start);
    if (cycle === 'monthly')
        result.setUTCMonth(result.getUTCMonth() + 1);
    if (cycle === 'yearly')
        result.setUTCFullYear(result.getUTCFullYear() + 1);
    if (cycle === 'one_time')
        result.setUTCMonth(result.getUTCMonth() + Math.max(1, Number(plan.one_time_duration_months || 12)));
    return result;
}
export async function completeMembershipPayment(input) {
    const paymentResult = await supabaseAdmin
        .from('membership_payments')
        .select('*,plan:membership_plans!membership_payments_plan_id_fkey(*)')
        .eq('id', input.paymentId)
        .single();
    if (paymentResult.error || !paymentResult.data)
        throw paymentResult.error || new Error('Membership payment was not found.');
    const payment = paymentResult.data;
    const plan = payment.plan;
    const wasAlreadyPaid = payment.status === 'paid';
    const paidAt = wasAlreadyPaid && payment.paid_at ? new Date(payment.paid_at) : new Date();
    const periodEnd = input.periodEnd === undefined ? periodEndForPlan(plan, payment.billing_cycle, paidAt) : input.periodEnd;
    let paidPayment = payment;
    if (!wasAlreadyPaid) {
        const updatePayment = await supabaseAdmin
            .from('membership_payments')
            .update({
            status: 'paid',
            paid_at: paidAt.toISOString(),
            provider_payment_id: input.providerPaymentId || payment.provider_payment_id || null,
            provider_subscription_id: input.providerSubscriptionId || payment.provider_subscription_id || null,
            provider_payload: { ...(payment.provider_payload || {}), ...(input.providerPayload || {}) }
        })
            .eq('id', payment.id)
            .select()
            .single();
        if (updatePayment.error)
            throw updatePayment.error;
        paidPayment = updatePayment.data;
    }
    const subscriptionPayload = {
        user_id: payment.user_id,
        plan_id: plan.id,
        payment_id: payment.id,
        billing_cycle: payment.billing_cycle,
        provider: payment.provider,
        provider_customer_id: input.providerCustomerId || null,
        provider_subscription_id: input.providerSubscriptionId || payment.provider_subscription_id || null,
        status: 'active',
        starts_at: paidAt.toISOString(),
        current_period_start: paidAt.toISOString(),
        current_period_end: periodEnd?.toISOString() || null,
        expires_at: periodEnd?.toISOString() || null,
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_ends_at: null,
        metadata: { accessLevel: plan.access_level, mentorshipAccess: plan.mentorship_access }
    };
    let subscriptionResult;
    if (subscriptionPayload.provider_subscription_id) {
        subscriptionResult = await supabaseAdmin
            .from('membership_subscriptions')
            .upsert(subscriptionPayload, { onConflict: 'provider_subscription_id' })
            .select()
            .single();
    }
    else {
        const existing = await supabaseAdmin
            .from('membership_subscriptions')
            .select('id')
            .eq('user_id', payment.user_id)
            .in('status', ['trialing', 'active', 'past_due', 'paused'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        subscriptionResult = existing.data
            ? await supabaseAdmin.from('membership_subscriptions').update(subscriptionPayload).eq('id', existing.data.id).select().single()
            : await supabaseAdmin.from('membership_subscriptions').insert(subscriptionPayload).select().single();
    }
    if (subscriptionResult.error)
        throw subscriptionResult.error;
    const profileResult = await supabaseAdmin
        .from('profiles')
        .update({
        membership_plan_id: plan.id,
        membership_level: plan.access_level,
        membership_status: 'active',
        membership_started_at: paidAt.toISOString(),
        membership_expires_at: periodEnd?.toISOString() || null,
        membership_billing_cycle: payment.billing_cycle,
        is_directory_visible: plan.directory_access
    })
        .eq('id', payment.user_id)
        .select('id,full_name')
        .single();
    if (profileResult.error)
        throw profileResult.error;
    const user = await supabaseAdmin.auth.admin.getUserById(payment.user_id);
    const email = user.data.user?.email;
    if (email && !wasAlreadyPaid) {
        await queueEmail({
            to: email,
            name: profileResult.data.full_name || undefined,
            templateKey: 'membership_activated',
            subject: `Your ${plan.name} membership is active`,
            payload: {
                memberName: profileResult.data.full_name || email.split('@')[0],
                planName: plan.name,
                billingCycle: payment.billing_cycle,
                amount: `${String(payment.currency).toUpperCase()} ${Number(payment.amount).toFixed(2)}`,
                expiryDate: periodEnd?.toISOString() || 'Lifetime',
                dashboardUrl: `${env.APP_URL}/dashboard`
            }
        });
    }
    return paidPayment;
}
export async function provisionMembershipSubscription(input) {
    const paymentResult = await supabaseAdmin
        .from('membership_payments')
        .select('*,plan:membership_plans!membership_payments_plan_id_fkey(*)')
        .eq('id', input.paymentId)
        .single();
    if (paymentResult.error || !paymentResult.data)
        throw paymentResult.error || new Error('Membership payment was not found.');
    const payment = paymentResult.data;
    const plan = payment.plan;
    if (payment.status === 'paid')
        return payment;
    const now = new Date();
    const periodEnd = input.periodEnd === undefined ? periodEndForPlan(plan, payment.billing_cycle, now) : input.periodEnd;
    const paymentUpdate = await supabaseAdmin
        .from('membership_payments')
        .update({
        status: 'processing',
        provider_subscription_id: input.providerSubscriptionId,
        provider_payload: { ...(payment.provider_payload || {}), awaitingInitialCharge: true, ...(input.providerPayload || {}) }
    })
        .eq('id', payment.id)
        .select()
        .single();
    if (paymentUpdate.error)
        throw paymentUpdate.error;
    const subscription = await supabaseAdmin
        .from('membership_subscriptions')
        .upsert({
        user_id: payment.user_id,
        plan_id: plan.id,
        payment_id: payment.id,
        billing_cycle: payment.billing_cycle,
        provider: payment.provider,
        provider_customer_id: input.providerCustomerId || null,
        provider_subscription_id: input.providerSubscriptionId,
        status: 'pending',
        starts_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd?.toISOString() || null,
        expires_at: periodEnd?.toISOString() || null,
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_ends_at: null,
        metadata: { accessLevel: plan.access_level, mentorshipAccess: plan.mentorship_access, awaitingInitialCharge: true }
    }, { onConflict: 'provider_subscription_id' })
        .select()
        .single();
    if (subscription.error)
        throw subscription.error;
    const profile = await supabaseAdmin.from('profiles').update({
        membership_plan_id: plan.id,
        membership_level: plan.access_level,
        membership_status: 'pending',
        membership_started_at: now.toISOString(),
        membership_expires_at: periodEnd?.toISOString() || null,
        membership_billing_cycle: payment.billing_cycle,
        is_directory_visible: false
    }).eq('id', payment.user_id);
    if (profile.error)
        throw profile.error;
    return paymentUpdate.data;
}
export async function activateMembershipTrial(input) {
    const paymentResult = await supabaseAdmin
        .from('membership_payments')
        .select('*,plan:membership_plans!membership_payments_plan_id_fkey(*)')
        .eq('id', input.paymentId)
        .single();
    if (paymentResult.error || !paymentResult.data)
        throw paymentResult.error || new Error('Membership payment was not found.');
    const payment = paymentResult.data;
    const plan = payment.plan;
    if (payment.status === 'paid')
        return payment;
    const now = new Date();
    const paymentUpdate = await supabaseAdmin
        .from('membership_payments')
        .update({
        status: 'processing',
        provider_subscription_id: input.providerSubscriptionId,
        provider_payload: { ...(payment.provider_payload || {}), trial: true, ...(input.providerPayload || {}) }
    })
        .eq('id', payment.id)
        .select()
        .single();
    if (paymentUpdate.error)
        throw paymentUpdate.error;
    const subscription = await supabaseAdmin
        .from('membership_subscriptions')
        .upsert({
        user_id: payment.user_id,
        plan_id: plan.id,
        payment_id: payment.id,
        billing_cycle: payment.billing_cycle,
        provider: payment.provider,
        provider_customer_id: input.providerCustomerId || null,
        provider_subscription_id: input.providerSubscriptionId,
        status: 'trialing',
        starts_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: input.trialEnd.toISOString(),
        expires_at: input.trialEnd.toISOString(),
        cancel_at_period_end: false,
        cancelled_at: null,
        grace_ends_at: null,
        metadata: { accessLevel: plan.access_level, mentorshipAccess: plan.mentorship_access, trial: true }
    }, { onConflict: 'provider_subscription_id' })
        .select()
        .single();
    if (subscription.error)
        throw subscription.error;
    const profileResult = await supabaseAdmin
        .from('profiles')
        .update({
        membership_plan_id: plan.id,
        membership_level: plan.access_level,
        membership_status: 'trialing',
        membership_started_at: now.toISOString(),
        membership_expires_at: input.trialEnd.toISOString(),
        membership_billing_cycle: payment.billing_cycle,
        is_directory_visible: plan.directory_access
    })
        .eq('id', payment.user_id)
        .select('id,full_name')
        .single();
    if (profileResult.error)
        throw profileResult.error;
    const user = await supabaseAdmin.auth.admin.getUserById(payment.user_id);
    const email = user.data.user?.email;
    if (email) {
        await queueEmail({
            to: email,
            name: profileResult.data.full_name || undefined,
            templateKey: 'membership_trial_started',
            subject: `Your ${plan.name} trial has started`,
            payload: {
                memberName: profileResult.data.full_name || email.split('@')[0],
                planName: plan.name,
                trialEnd: input.trialEnd.toISOString(),
                dashboardUrl: `${env.APP_URL}/dashboard`
            }
        });
    }
    return paymentUpdate.data;
}
export async function recordMembershipRenewal(input) {
    const existing = await supabaseAdmin.from('membership_payments').select('id').eq('provider_session_id', input.providerSessionId).maybeSingle();
    if (existing.error)
        throw existing.error;
    if (existing.data)
        return existing.data;
    const subscriptionResult = await supabaseAdmin
        .from('membership_subscriptions')
        .select('*,plan:membership_plans!membership_subscriptions_plan_id_fkey(*)')
        .eq('provider_subscription_id', input.providerSubscriptionId)
        .single();
    if (subscriptionResult.error || !subscriptionResult.data)
        throw subscriptionResult.error || new Error('Membership subscription was not found.');
    const subscription = subscriptionResult.data;
    const plan = subscription.plan;
    const periodStart = input.periodStart || new Date();
    const periodEnd = input.periodEnd === undefined ? periodEndForPlan(plan, subscription.billing_cycle, periodStart) : input.periodEnd;
    const paymentResult = await supabaseAdmin.from('membership_payments').insert({
        user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        billing_cycle: subscription.billing_cycle,
        provider: subscription.provider,
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        status: 'paid',
        provider_session_id: input.providerSessionId,
        provider_payment_id: input.providerPaymentId,
        provider_subscription_id: input.providerSubscriptionId,
        provider_payload: { renewal: true, ...(input.providerPayload || {}) },
        paid_at: new Date().toISOString()
    }).select().single();
    if (paymentResult.error)
        throw paymentResult.error;
    const subscriptionUpdate = await supabaseAdmin.from('membership_subscriptions').update({
        payment_id: paymentResult.data.id,
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd?.toISOString() || null,
        expires_at: periodEnd?.toISOString() || null,
        grace_ends_at: null
    }).eq('id', subscription.id).select().single();
    if (subscriptionUpdate.error)
        throw subscriptionUpdate.error;
    const profile = await supabaseAdmin.from('profiles').update({
        membership_status: 'active',
        membership_expires_at: periodEnd?.toISOString() || null
    }).eq('id', subscription.user_id).select('full_name').single();
    if (profile.error)
        throw profile.error;
    const user = await supabaseAdmin.auth.admin.getUserById(subscription.user_id);
    if (user.data.user?.email) {
        await queueEmail({
            to: user.data.user.email,
            name: profile.data.full_name || undefined,
            templateKey: 'membership_renewed',
            subject: `${plan.name} membership renewed`,
            payload: {
                memberName: profile.data.full_name || user.data.user.email.split('@')[0],
                planName: plan.name,
                billingCycle: subscription.billing_cycle,
                amount: `${input.currency.toUpperCase()} ${input.amount.toFixed(2)}`,
                expiryDate: periodEnd?.toISOString() || 'Lifetime',
                receiptNumber: paymentResult.data.receipt_number || '',
                receiptUrl: `${env.APP_URL}/membership-receipt/${paymentResult.data.receipt_token}`
            }
        });
    }
    return paymentResult.data;
}
export async function markMembershipPastDue(providerSubscriptionId) {
    const { data, error } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('id,user_id,plan:membership_plans!membership_subscriptions_plan_id_fkey(grace_period_days)')
        .eq('provider_subscription_id', providerSubscriptionId)
        .maybeSingle();
    if (error)
        throw error;
    if (!data)
        return;
    const graceDays = Number(data.plan?.grace_period_days || 7);
    const graceEnd = new Date();
    graceEnd.setUTCDate(graceEnd.getUTCDate() + graceDays);
    await supabaseAdmin.from('membership_subscriptions').update({ status: 'past_due', grace_ends_at: graceEnd.toISOString() }).eq('id', data.id);
    const profile = await supabaseAdmin.from('profiles').update({ membership_status: 'past_due' }).eq('id', data.user_id).select('full_name').single();
    const user = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (user.data.user?.email)
        await queueEmail({ to: user.data.user.email, name: profile.data?.full_name || undefined, templateKey: 'membership_payment_failed', subject: 'Membership payment needs attention', payload: { memberName: profile.data?.full_name || '', graceEnd: graceEnd.toISOString(), dashboardUrl: `${env.APP_URL}/dashboard` } });
}
export async function cancelMembershipByProviderSubscription(providerSubscriptionId, immediate = false) {
    const { data, error } = await supabaseAdmin
        .from('membership_subscriptions')
        .select('*,plan:membership_plans!membership_subscriptions_plan_id_fkey(name)')
        .eq('provider_subscription_id', providerSubscriptionId)
        .maybeSingle();
    if (error)
        throw error;
    if (!data)
        return;
    const now = new Date().toISOString();
    if (immediate) {
        await supabaseAdmin.from('membership_subscriptions').update({ status: 'cancelled', cancelled_at: now, cancel_at_period_end: false }).eq('id', data.id);
        await supabaseAdmin.from('profiles').update({ membership_status: 'cancelled', membership_expires_at: now }).eq('id', data.user_id);
    }
    else {
        await supabaseAdmin.from('membership_subscriptions').update({ cancel_at_period_end: true, cancelled_at: now }).eq('id', data.id);
    }
    const profile = await supabaseAdmin.from('profiles').select('full_name').eq('id', data.user_id).single();
    const user = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (user.data.user?.email)
        await queueEmail({
            to: user.data.user.email,
            name: profile.data?.full_name || undefined,
            templateKey: 'membership_cancelled',
            subject: 'Membership cancellation confirmed',
            payload: { memberName: profile.data?.full_name || '', planName: data.plan?.name || 'Membership', expiryDate: immediate ? now : data.current_period_end || data.expires_at || now }
        });
}
export async function assertMentorshipAccess(userId, required = 'request') {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('membership_status,membership_expires_at,membership_plan_id,plan:membership_plans!profiles_membership_plan_id_fkey(mentorship_access)')
        .eq('id', userId)
        .single();
    if (error)
        throw error;
    const expiry = data.membership_expires_at ? new Date(data.membership_expires_at).getTime() : null;
    if (!['active', 'trialing'].includes(data.membership_status) || (expiry !== null && expiry <= Date.now()))
        throw new Error('An active membership is required for mentorship.');
    const access = String(data.plan?.mentorship_access || 'browse');
    const rank = { browse: 0, request: 1, priority: 2 };
    if ((rank[access] ?? 0) < (rank[required] ?? 0))
        throw new Error(required === 'priority' ? 'Elite membership is required for priority mentorship.' : 'Legacy or Elite membership is required to request mentorship.');
    return access;
}
export async function reconcileExpiredMembership(userId) {
    const now = new Date();
    const profileResult = await supabaseAdmin
        .from('profiles')
        .select('id,membership_status,membership_expires_at')
        .eq('id', userId)
        .single();
    if (profileResult.error || !profileResult.data)
        return false;
    const expiresAt = profileResult.data.membership_expires_at ? new Date(profileResult.data.membership_expires_at) : null;
    const canExpire = ['active', 'trialing', 'past_due', 'paused'].includes(String(profileResult.data.membership_status));
    if (!canExpire || !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > now.getTime())
        return false;
    const profileUpdate = await supabaseAdmin.from('profiles').update({ membership_status: 'expired', is_directory_visible: false }).eq('id', userId);
    if (profileUpdate.error)
        throw profileUpdate.error;
    const subscriptionsUpdate = await supabaseAdmin
        .from('membership_subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', userId)
        .in('status', ['pending', 'trialing', 'active', 'past_due', 'paused'])
        .lte('expires_at', now.toISOString());
    if (subscriptionsUpdate.error)
        throw subscriptionsUpdate.error;
    return true;
}
