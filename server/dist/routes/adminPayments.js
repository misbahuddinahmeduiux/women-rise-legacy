import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { writeAudit } from '../lib/audit.js';
import { decryptCredentials, encryptCredentials, sanitizeGateway, testGatewayConnection } from '../lib/paymentGateways.js';
import { queueDonationReceiptEmail } from '../lib/donationReceipts.js';
export const adminPaymentsRouter = Router();
adminPaymentsRouter.use(requireUser, requireAdmin);
const providerSchema = z.enum(['stripe', 'paypal', 'bank_transfer']);
const connectSchema = z.object({
    displayName: z.string().min(2).max(80),
    mode: z.enum(['test', 'live']),
    isEnabled: z.boolean().default(true),
    publicConfig: z.record(z.string(), z.unknown()).default({}),
    settings: z.record(z.string(), z.unknown()).default({}),
    credentials: z.record(z.string(), z.unknown()).default({})
});
adminPaymentsRouter.get('/', async (_req, res, next) => {
    try {
        const { data, error } = await supabaseAdmin.from('payment_gateway_configs').select('*').order('provider');
        if (error)
            throw error;
        res.json((data ?? []).map((row) => sanitizeGateway(row)));
    }
    catch (error) {
        next(error);
    }
});
adminPaymentsRouter.post('/:provider/connect', async (req, res, next) => {
    try {
        const provider = providerSchema.parse(req.params.provider);
        const input = connectSchema.parse(req.body);
        const { data: existing, error: existingError } = await supabaseAdmin
            .from('payment_gateway_configs').select('*').eq('provider', provider).maybeSingle();
        if (existingError)
            throw existingError;
        const previousCredentials = decryptCredentials(existing?.credentials_encrypted);
        const mergedCredentials = mergeSecrets(previousCredentials, input.credentials);
        const publicConfig = normalizePublicConfig(provider, input.publicConfig);
        const settings = normalizeSettings(provider, input.settings);
        const testResult = await testGatewayConnection({
            provider,
            mode: input.mode,
            publicConfig,
            settings,
            credentials: mergedCredentials
        });
        const payload = {
            provider,
            display_name: input.displayName,
            mode: input.mode,
            is_enabled: input.isEnabled,
            is_connected: true,
            credentials_encrypted: Object.keys(mergedCredentials).length ? encryptCredentials(mergedCredentials) : null,
            public_config: publicConfig,
            settings,
            last_tested_at: new Date().toISOString(),
            last_error: null,
            created_by: existing?.created_by || req.profile.id,
            updated_by: req.profile.id
        };
        const { data, error } = await supabaseAdmin
            .from('payment_gateway_configs').upsert(payload, { onConflict: 'provider' }).select().single();
        if (error)
            throw error;
        await writeAudit(req, {
            action: 'connect', entityType: 'payment_gateway_configs', entityId: provider,
            summary: `Connected ${provider} payment method`, beforeData: sanitizeForAudit(existing), afterData: sanitizeForAudit(data)
        });
        res.json({ gateway: sanitizeGateway(data), message: testResult.message, details: testResult.details });
    }
    catch (error) {
        const provider = safeProvider(req.params.provider);
        if (provider) {
            await supabaseAdmin.from('payment_gateway_configs').update({
                is_connected: false,
                is_enabled: false,
                last_tested_at: new Date().toISOString(),
                last_error: error instanceof Error ? error.message : 'Connection failed.'
            }).eq('provider', provider);
        }
        next(error);
    }
});
adminPaymentsRouter.post('/:provider/test', async (req, res, next) => {
    try {
        const provider = providerSchema.parse(req.params.provider);
        const { data, error } = await supabaseAdmin.from('payment_gateway_configs').select('*').eq('provider', provider).single();
        if (error)
            throw error;
        const row = data;
        const result = await testGatewayConnection({
            provider,
            mode: row.mode,
            publicConfig: row.public_config || {},
            settings: row.settings || {},
            credentials: decryptCredentials(row.credentials_encrypted)
        });
        const { data: updated, error: updateError } = await supabaseAdmin.from('payment_gateway_configs').update({
            is_connected: true,
            last_tested_at: new Date().toISOString(),
            last_error: null
        }).eq('provider', provider).select().single();
        if (updateError)
            throw updateError;
        res.json({ gateway: sanitizeGateway(updated), message: result.message, details: result.details });
    }
    catch (error) {
        const provider = safeProvider(req.params.provider);
        if (provider)
            await supabaseAdmin.from('payment_gateway_configs').update({ is_connected: false, is_enabled: false, last_tested_at: new Date().toISOString(), last_error: error instanceof Error ? error.message : 'Connection failed.' }).eq('provider', provider);
        next(error);
    }
});
adminPaymentsRouter.patch('/:provider', async (req, res, next) => {
    try {
        const provider = providerSchema.parse(req.params.provider);
        const input = z.object({
            displayName: z.string().min(2).max(80).optional(),
            mode: z.enum(['test', 'live']).optional(),
            isEnabled: z.boolean().optional(),
            publicConfig: z.record(z.string(), z.unknown()).optional(),
            settings: z.record(z.string(), z.unknown()).optional()
        }).parse(req.body);
        const { data: before, error: beforeError } = await supabaseAdmin.from('payment_gateway_configs').select('*').eq('provider', provider).single();
        if (beforeError)
            throw beforeError;
        if (input.isEnabled && !before.is_connected)
            return res.status(400).json({ error: 'Connect and verify this payment method before enabling it.' });
        const updates = { updated_by: req.profile.id };
        if (input.displayName !== undefined)
            updates.display_name = input.displayName;
        if (input.mode !== undefined)
            updates.mode = input.mode;
        if (input.isEnabled !== undefined)
            updates.is_enabled = input.isEnabled;
        if (input.publicConfig !== undefined)
            updates.public_config = normalizePublicConfig(provider, input.publicConfig);
        if (input.settings !== undefined)
            updates.settings = normalizeSettings(provider, input.settings);
        const { data, error } = await supabaseAdmin.from('payment_gateway_configs').update(updates).eq('provider', provider).select().single();
        if (error)
            throw error;
        await writeAudit(req, { action: 'update', entityType: 'payment_gateway_configs', entityId: provider, summary: `Updated ${provider} payment settings`, beforeData: sanitizeForAudit(before), afterData: sanitizeForAudit(data) });
        res.json(sanitizeGateway(data));
    }
    catch (error) {
        next(error);
    }
});
adminPaymentsRouter.post('/:provider/disconnect', async (req, res, next) => {
    try {
        const provider = providerSchema.parse(req.params.provider);
        const { data: before } = await supabaseAdmin.from('payment_gateway_configs').select('*').eq('provider', provider).maybeSingle();
        const { data, error } = await supabaseAdmin.from('payment_gateway_configs').update({
            is_enabled: false,
            is_connected: false,
            credentials_encrypted: null,
            last_error: null,
            updated_by: req.profile.id
        }).eq('provider', provider).select().single();
        if (error)
            throw error;
        await writeAudit(req, { action: 'disconnect', entityType: 'payment_gateway_configs', entityId: provider, summary: `Disconnected ${provider} payment method`, beforeData: sanitizeForAudit(before), afterData: sanitizeForAudit(data) });
        res.json(sanitizeGateway(data));
    }
    catch (error) {
        next(error);
    }
});
adminPaymentsRouter.get('/transactions/list', async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit || 250), 500);
        const { data, error } = await supabaseAdmin.from('donations')
            .select('id,receipt_number,receipt_token,donor_name,donor_email,amount,currency,frequency,designation,payment_provider,payment_status,payment_session_id,provider_reference,admin_note,created_at,updated_at')
            .order('created_at', { ascending: false }).limit(limit);
        if (error)
            throw error;
        res.json(data ?? []);
    }
    catch (error) {
        next(error);
    }
});
adminPaymentsRouter.patch('/transactions/:id/status', async (req, res, next) => {
    try {
        const input = z.object({ status: z.enum(['pending', 'paid', 'failed', 'refunded', 'cancelled']), note: z.string().max(1000).optional().default('') }).parse(req.body);
        const { data: before, error: beforeError } = await supabaseAdmin.from('donations').select('*').eq('id', req.params.id).single();
        if (beforeError)
            throw beforeError;
        if (before.payment_provider !== 'bank_transfer')
            return res.status(400).json({ error: 'Only bank-transfer payments can be manually reconciled here.' });
        const { data, error } = await supabaseAdmin.from('donations').update({ payment_status: input.status, admin_note: input.note || null }).eq('id', req.params.id).select().single();
        if (error)
            throw error;
        if (input.status === 'paid')
            await queueDonationReceiptEmail(data);
        await writeAudit(req, { action: 'reconcile', entityType: 'donations', entityId: req.params.id, summary: `Marked bank transfer ${input.status}`, beforeData: before, afterData: data });
        res.json(data);
    }
    catch (error) {
        next(error);
    }
});
function mergeSecrets(previous, incoming) {
    const result = { ...previous };
    for (const [key, value] of Object.entries(incoming)) {
        if (typeof value === 'string' && !value.trim())
            continue;
        if (value !== undefined && value !== null)
            result[key] = value;
    }
    return result;
}
function normalizePublicConfig(provider, input) {
    const currency = String(input.currency || 'usd').trim().toLowerCase().slice(0, 3);
    if (provider === 'stripe')
        return { currency, publishableKey: String(input.publishableKey || '').trim() };
    if (provider === 'paypal')
        return { currency, clientId: String(input.clientId || '').trim() };
    return {
        currency,
        bankName: String(input.bankName || '').trim(),
        accountName: String(input.accountName || '').trim(),
        accountNumber: String(input.accountNumber || '').trim(),
        routingNumber: String(input.routingNumber || '').trim(),
        iban: String(input.iban || '').trim(),
        swift: String(input.swift || '').trim()
    };
}
function normalizeSettings(provider, input) {
    return {
        description: String(input.description || '').trim(),
        supportsRecurring: provider === 'stripe',
        instructions: provider === 'bank_transfer' ? String(input.instructions || 'Use your donation reference in the transfer memo.').trim() : undefined
    };
}
function safeProvider(value) {
    return ['stripe', 'paypal', 'bank_transfer'].includes(value) ? value : null;
}
function sanitizeForAudit(row) {
    if (!row)
        return null;
    const { credentials_encrypted: _credentials, ...safe } = row;
    return safe;
}
