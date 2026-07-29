import { env } from '../config/env.js';
import { supabaseAdmin } from './supabase.js';
export async function queueEmail(input) {
    const templateResult = await supabaseAdmin
        .from('email_templates')
        .select('subject,html_body,text_body,is_active')
        .eq('template_key', input.templateKey)
        .maybeSingle();
    const template = !templateResult.error && templateResult.data?.is_active
        ? templateResult.data
        : null;
    const variables = buildVariables(input);
    const subject = renderPlainTemplate(template?.subject || input.subject, variables);
    const html = input.html || (template?.html_body ? renderTemplate(template.html_body, variables) : renderDefaultEmail(subject, variables));
    const text = input.text || (template?.text_body ? renderPlainTemplate(template.text_body, variables) : renderTextEmail(subject, variables));
    const { data, error } = await supabaseAdmin.from('email_queue').insert({
        recipient_email: input.to,
        recipient_name: input.name || null,
        template_key: input.templateKey,
        subject,
        html_body: html,
        text_body: text,
        payload: input.payload ?? {}
    }).select().single();
    if (error) {
        console.error('Email queue insert failed:', error.message);
        return null;
    }
    if (!env.RESEND_API_KEY)
        return data;
    try {
        await supabaseAdmin.from('email_queue').update({ status: 'sending', attempt_count: 1 }).eq('id', data.id);
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: env.EMAIL_FROM, to: [input.to], subject, html, text })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body.message || `Email provider returned ${response.status}`);
        await supabaseAdmin.from('email_queue').update({ status: 'sent', provider_message_id: body.id || null, sent_at: new Date().toISOString() }).eq('id', data.id);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Email delivery failed.';
        await supabaseAdmin.from('email_queue').update({ status: 'failed', last_error: message }).eq('id', data.id);
    }
    return data;
}
function buildVariables(input) {
    const variables = {
        recipient_name: input.name || '',
        recipient_email: input.to,
        app_name: env.APP_NAME,
        app_url: env.APP_URL
    };
    for (const [key, value] of Object.entries(input.payload ?? {})) {
        const stringValue = String(value ?? '');
        variables[key] = stringValue;
        variables[toSnakeCase(key)] = stringValue;
    }
    return variables;
}
function renderPlainTemplate(source, variables) {
    return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => variables[key] ?? '');
}
function renderTemplate(source, variables) {
    return source.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => escapeHtml(variables[key] ?? ''));
}
function renderDefaultEmail(subject, variables) {
    const ignored = new Set(['recipient_email', 'app_name', 'app_url']);
    const content = Object.entries(variables)
        .filter(([key]) => !ignored.has(key) && !/[A-Z]/.test(key))
        .map(([key, value]) => `<p><strong>${escapeHtml(key.replaceAll('_', ' '))}:</strong> ${escapeHtml(value)}</p>`)
        .join('');
    return `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:28px;color:#2d2030"><h1 style="color:#5a146b">${escapeHtml(env.APP_NAME)}</h1><h2>${escapeHtml(subject)}</h2>${content}<p>Thank you for being part of Women Rise Legacy Network & Foundation.</p></div>`;
}
function renderTextEmail(subject, variables) {
    const lines = Object.entries(variables)
        .filter(([key]) => !/[A-Z]/.test(key) && !['recipient_email', 'app_name', 'app_url'].includes(key))
        .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`);
    return [subject, '', ...lines, '', 'Thank you for being part of Women Rise Legacy Network & Foundation.'].join('\n');
}
function toSnakeCase(value) {
    return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}
