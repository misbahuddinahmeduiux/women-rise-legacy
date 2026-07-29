# Phase 2.2 Deployment Guide

## Recommended architecture

- Frontend: Vercel (`client` root directory)
- Backend: Render (`server` root directory), using `render.yaml`
- Database and authentication: Supabase

An optional fallback deploys the Express backend as a second Vercel project using the `server` root directory.

## Render Blueprint

The repository root includes `render.yaml` with:

- Node runtime
- Free instance plan
- Ohio region
- `server` root directory
- `npm install && npm run build`
- `npm start`
- `/api/health` health check
- automatic deploys on commits

In Render, create a Blueprint from the repository and enter every environment variable whose value is not committed.

Required backend variables:

```env
CLIENT_URL=https://YOUR_FRONTEND.vercel.app
CLIENT_URLS=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SECRET_KEY
PAYMENT_MODE=demo
STRIPE_CURRENCY=usd
NODE_ENV=production
```

Do not add `PORT`; Render supplies it.

## Vercel frontend

Import the repository and choose `client` as Root Directory. `client/vercel.json` version-controls Vite build settings and React SPA routing.

Required frontend variables:

```env
VITE_API_URL=https://YOUR_BACKEND_DOMAIN/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Never add the Supabase secret/service-role key to the frontend project.

## Optional Vercel backend fallback

The Express application exports its app as the default export from `server/src/index.ts`, allowing Vercel to detect it as an Express project. Import the repository again, select `server` as Root Directory, and add the backend environment variables.

Use the resulting backend URL in the frontend's `VITE_API_URL`.

## CORS configuration

The backend accepts exact origins configured through:

- `CLIENT_URL`: primary production frontend origin
- `CLIENT_URLS`: optional comma-separated additional origins

Example:

```env
CLIENT_URL=https://women-rise-legacy-client.vercel.app
CLIENT_URLS=http://localhost:5173,https://preview-example.vercel.app
```

Do not include trailing slashes.

## Supabase Auth URL configuration

After the Vercel frontend URL is known, set:

```text
Site URL: https://YOUR-FRONTEND.vercel.app
Redirect URLs:
https://YOUR-FRONTEND.vercel.app/**
http://localhost:5173/**
```

## Verification

Backend:

```text
https://YOUR-BACKEND/api/health
https://YOUR-BACKEND/api/public/current-needs
```

Frontend:

```text
/
/dashboard
/admin
/members
/mentors
/businesses
/events
/resources
```
