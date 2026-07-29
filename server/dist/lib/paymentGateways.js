import crypto from 'node:crypto';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { supabaseAdmin } from './supabase.js';
const encryptionMaterial = env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKey = crypto.createHash('sha256').update(encryptionMaterial).digest();
export function encryptCredentials(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}
export function decryptCredentials(payload) {
    if (!payload)
        return {};
    const [version, ivText, tagText, dataText] = payload.split('.');
    if (version !== 'v1' || !ivText || !tagText || !dataText)
        throw new Error('Stored payment credentials are invalid. Reconnect the payment method.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}
export async function getGateway(provider, requireEnabled = true) {
    let query = supabaseAdmin.from('payment_gateway_configs').select('*').eq('provider', provider);
    if (requireEnabled)
        query = query.eq('is_enabled', true).eq('is_connected', true);
    const { data, error } = await query.maybeSingle();
    if (error)
        throw error;
    if (!data)
        throw new Error(`${providerLabel(provider)} is not enabled.`);
    return data;
}
export async function listPublicGateways() {
    const { data, error } = await supabaseAdmin
        .from('payment_gateway_configs')
        .select('provider,display_name,mode,public_config,settings')
        .eq('is_enabled', true)
        .eq('is_connected', true)
        .order('provider');
    if (error)
        throw error;
    return (data ?? []).map((row) => ({
        provider: row.provider,
        displayName: row.display_name,
        mode: row.mode,
        currency: String(row.public_config?.currency || 'usd').toLowerCase(),
        supportsRecurring: Boolean(row.settings?.supportsRecurring),
        description: String(row.settings?.description || defaultDescription(row.provider)),
        bankDetails: row.provider === 'bank_transfer' ? sanitizeBankDetails(row.public_config, row.settings) : undefined
    }));
}
export function sanitizeGateway(row) {
    const credentials = decryptCredentials(row.credentials_encrypted);
    return {
        id: row.id,
        provider: row.provider,
        displayName: row.display_name,
        mode: row.mode,
        isEnabled: row.is_enabled,
        isConnected: row.is_connected,
        publicConfig: row.public_config || {},
        settings: row.settings || {},
        lastTestedAt: row.last_tested_at,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        secretFields: Object.fromEntries(Object.entries(credentials).map(([key, value]) => [key, maskSecret(String(value || ''))]))
    };
}
export async function testGatewayConnection(input) {
    if (input.provider === 'stripe') {
        const secretKey = String(input.credentials.secretKey || '');
        const publishableKey = String(input.publicConfig.publishableKey || '');
        if (!secretKey.startsWith(input.mode === 'live' ? 'sk_live_' : 'sk_test_'))
            throw new Error(`Use a Stripe ${input.mode} secret key.`);
        if (!publishableKey.startsWith(input.mode === 'live' ? 'pk_live_' : 'pk_test_'))
            throw new Error(`Use a Stripe ${input.mode} publishable key.`);
        if (!String(input.credentials.webhookSecret || '').startsWith('whsec_'))
            throw new Error('A Stripe webhook signing secret beginning with whsec_ is required.');
        const stripe = new Stripe(secretKey);
        const balance = await stripe.balance.retrieve();
        return { message: 'Stripe connected successfully.', details: { availableCurrencies: balance.available.map((item) => item.currency) } };
    }
    if (input.provider === 'paypal') {
        const clientId = String(input.publicConfig.clientId || '');
        const clientSecret = String(input.credentials.clientSecret || '');
        if (!clientId || !clientSecret)
            throw new Error('PayPal Client ID and Client Secret are required.');
        await getPayPalAccessToken(input.mode, clientId, clientSecret);
        return { message: 'PayPal connected successfully.', details: { environment: input.mode, webhookConfigured: Boolean(input.credentials.webhookId) } };
    }
    const bankName = String(input.publicConfig.bankName || '').trim();
    const accountName = String(input.publicConfig.accountName || '').trim();
    const accountNumber = String(input.publicConfig.accountNumber || '').trim();
    const iban = String(input.publicConfig.iban || '').trim();
    if (!bankName || !accountName || (!accountNumber && !iban))
        throw new Error('Bank name, account name, and an account number or IBAN are required.');
    return { message: 'Bank transfer instructions are ready.', details: { bankName } };
}
export async function getPayPalAccessToken(mode, clientId, clientSecret) {
    const response = await fetch(`${paypalBaseUrl(mode)}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json'
        },
        body: 'grant_type=client_credentials'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token)
        throw new Error(payload.error_description || payload.error || 'PayPal authentication failed.');
    return payload.access_token;
}
export function paypalBaseUrl(mode) {
    return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}
export function providerLabel(provider) {
    if (provider === 'stripe')
        return 'Stripe';
    if (provider === 'paypal')
        return 'PayPal';
    return 'Bank transfer';
}
export function maskSecret(value) {
    if (!value)
        return '';
    if (value.length <= 8)
        return '••••••••';
    return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}
function defaultDescription(provider) {
    if (provider === 'stripe')
        return 'Pay securely by credit or debit card.';
    if (provider === 'paypal')
        return 'Pay with your PayPal account or supported PayPal funding source.';
    return 'Send a bank transfer using the instructions provided after checkout.';
}
function sanitizeBankDetails(publicConfig, settings) {
    return {
        bankName: String(publicConfig.bankName || ''),
        accountName: String(publicConfig.accountName || ''),
        accountNumber: String(publicConfig.accountNumber || ''),
        routingNumber: String(publicConfig.routingNumber || ''),
        iban: String(publicConfig.iban || ''),
        swift: String(publicConfig.swift || ''),
        instructions: String(settings.instructions || 'Use your donation reference in the transfer memo.')
    };
}
