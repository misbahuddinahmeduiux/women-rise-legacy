import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { publicRouter } from './routes/public.js';
import { formsRouter } from './routes/forms.js';
import { paymentsRouter, stripeWebhook } from './routes/payments.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { networkRouter } from './routes/network.js';
import { publicError } from './lib/helpers.js';
import { createRateLimiter } from './middleware/rateLimit.js';

const app = express();
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'women-rise-legacy-api' }));
app.use('/api/public', publicRouter);
app.use('/api/forms', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 }), formsRouter);
app.use('/api/payments', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), paymentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/network', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 }), networkRouter);
app.use('/api/admin', adminRouter);

app.use((_req: express.Request, res: express.Response) => res.status(404).json({ error: 'Route not found.' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Validation failed.', details: error.flatten().fieldErrors });
  console.error(error);
  res.status(500).json({ error: publicError(error) });
});

app.listen(env.PORT, () => console.log(`Women Rise Legacy API running at http://localhost:${env.PORT}`));
