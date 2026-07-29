import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
    PORT: z.coerce.number().default(5050),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    CLIENT_URLS: z.string().optional().default(''),
    APP_URL: z.string().url().optional().default('http://localhost:5173'),
    APP_NAME: z.string().min(2).default('Women Rise Legacy'),
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(10),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
    PAYMENT_MODE: z.enum(['demo', 'disabled', 'stripe']).default('demo'),
    PAYMENT_CREDENTIALS_ENCRYPTION_KEY: z.string().optional().default(''),
    STRIPE_SECRET_KEY: z.string().optional().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
    STRIPE_CURRENCY: z.string().length(3).default('usd'),
    RESEND_API_KEY: z.string().optional().default(''),
    EMAIL_FROM: z.string().default('Women Rise Legacy <noreply@example.com>')
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid server environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Server environment configuration is incomplete. Copy server/.env.example to server/.env.');
}
const values = parsed.data;
export const env = {
    ...values,
    ALLOWED_CLIENT_URLS: Array.from(new Set([values.CLIENT_URL, ...values.CLIENT_URLS.split(',')]
        .map((value) => value.trim().replace(/\/$/, ''))
        .filter(Boolean)))
};
