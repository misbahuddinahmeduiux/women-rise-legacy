import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { publicRouter } from './routes/public.js';
import { formsRouter } from './routes/forms.js';
import { paymentsRouter, paypalWebhook, stripeWebhook } from './routes/payments.js';
import { dashboardRouter } from './routes/dashboard.js';
import { adminRouter } from './routes/admin.js';
import { adminPaymentsRouter } from './routes/adminPayments.js';
import { networkRouter } from './routes/network.js';
import { membershipsRouter } from './routes/memberships.js';
import { phase4Router } from './routes/phase4.js';
import { adminPhase4Router } from './routes/adminPhase4.js';
import { publicError } from './lib/helpers.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { supabaseAdmin } from './lib/supabase.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestId);

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/api/payments/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false, referrerPolicy: { policy: 'strict-origin-when-cross-origin' } }));
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Requests without an Origin header include health checks and server-to-server calls.
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      if (env.ALLOWED_CLIENT_URLS.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.warn(`Blocked CORS origin: ${normalizedOrigin}`);
      return callback(new Error('Origin is not allowed by CORS.'));
    }
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.post('/api/payments/webhooks/paypal', paypalWebhook);

app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'women-rise-legacy-api',
    version: '5.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  })
);
app.get('/api/ready', async (_req, res) => {
  const { error } = await supabaseAdmin.from('site_settings').select('key', { head: true, count: 'exact' });
  if (error) return res.status(503).json({ status: 'not_ready', database: error.message });
  return res.json({ status: 'ready', database: 'connected', version: '5.0.0' });
});
app.use('/api/public', publicRouter);
app.use('/api/phase4', phase4Router);
app.use('/api/memberships', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 }), membershipsRouter);
app.use('/api/forms', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 }), formsRouter);
app.use('/api/payments', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }), paymentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/network', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40 }), networkRouter);
app.use('/api/admin/payment-methods', adminPaymentsRouter);
app.use('/api/admin/phase4', adminPhase4Router);
app.use('/api/admin', adminRouter);

app.use((_req: express.Request, res: express.Response) => res.status(404).json({ error: 'Route not found.' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed.', details: error.flatten().fieldErrors });
  }

  console.error(error);
  return res.status(500).json({ error: publicError(error), requestId: _req.requestId });
});

// Vercel detects the default export and runs the Express app as a function.
// Render and local development use the normal HTTP listener.
if (!process.env.VERCEL) {
  app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`Women Rise Legacy API running on port ${env.PORT}`);
  });
}

export default app;
