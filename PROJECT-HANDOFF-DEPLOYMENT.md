# Women Rise Legacy — Phase 2.2 Deployment Handoff

## Completed in the package

- Phase 1 foundation and authentication
- Phase 2 network/database modules
- Phase 2.1 branded and responsive UI
- Corrected Phase 2 SQL (`"current_role"`)
- Git-safe `.gitignore`
- Vercel frontend configuration and SPA rewrites
- Render Blueprint with Free plan
- Optional Vercel Express backend compatibility
- Multi-origin production CORS configuration
- Deployment-first documentation

## External deployment status

A ZIP cannot create or authenticate hosting accounts by itself. The live deployment is complete only after the hosting dashboards produce working URLs and the URLs pass verification.

### Required final external actions

1. Push this updated package to GitHub.
2. Create/sync the Render Blueprint and enter backend variables.
3. Confirm `https://BACKEND/api/health`.
4. Create the Vercel frontend project from `client`.
5. Set `VITE_API_URL` to the confirmed backend URL plus `/api`.
6. Set Render `CLIENT_URL` to the exact Vercel frontend origin.
7. Update Supabase Site URL and Redirect URLs.
8. Test authentication, dashboard, admin, public data and direct route refresh.

## Security

- `.env` files and real secrets are intentionally excluded.
- A previously exposed Supabase secret must be rotated before production handover.
- The service-role secret belongs only in the backend hosting environment.

## Continue in a new chat

```text
Continue Women Rise Legacy deployment using PROJECT-HANDOFF-DEPLOYMENT.md.
The code package is Phase 2.2 Deployment Ready. GitHub/Supabase setup exists, but do not call deployment complete until live backend and frontend URLs pass the documented tests. Continue one external hosting step at a time and do not request secret values in chat.
```

## Phase 3.1 payment deployment
- Backend environment requires `PAYMENT_CREDENTIALS_ENCRYPTION_KEY`.
- Stripe and PayPal credentials are entered from Admin → Payment Methods after deployment.
- Frontend/Vercel must never contain provider secret credentials.
- Configure Stripe webhook at `https://<backend>/api/payments/webhooks/stripe`.
- Configure PayPal webhook at `https://<backend>/api/payments/webhooks/paypal`.
- Bank transfer needs no external API and is reconciled in the admin payment transaction table.
