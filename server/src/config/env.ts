import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(5050),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  PAYMENT_MODE: z.enum(['demo', 'stripe']).default('demo'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_CURRENCY: z.string().length(3).default('usd')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Server environment configuration is incomplete. Copy server/.env.example to server/.env.');
}

export const env = parsed.data;
