# Deployment Guide

Recommended deployment:

- Frontend: Vercel, Netlify, or Cloudflare Pages
- Backend: Railway, Render, Fly.io, or VPS
- Database/Auth/Storage: Supabase

Set `VITE_API_URL` to the deployed backend URL. Set `CLIENT_URL` on the backend to the deployed frontend origin. Add all server secrets through the hosting provider's environment-variable settings.

Before launch:

- Disable demo payments by configuring Stripe.
- Configure Stripe production webhook.
- Configure Supabase Auth site URL and redirect URLs.
- Create the real admin user.
- Replace sample content and external image URLs.
- Review privacy policy, donation terms, refund policy, and nonprofit legal disclosures.
- Test forms, permissions, mobile layouts, payment success/cancel flows, and backups.
