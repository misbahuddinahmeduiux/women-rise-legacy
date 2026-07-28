# API Overview

Base URL: `/api`

## Public

- `GET /health`
- `GET /public/stats`
- `GET /public/current-needs`
- `GET /public/current-needs/:slug`
- `GET /public/campaigns`
- `GET /public/campaigns/:slug`
- `GET /public/sponsor-families`
- `GET /public/sponsor-families/:slug`
- `GET /public/impact-stories`
- `GET /public/impact-reports`
- `GET /public/countries-served`

## Forms

- `POST /forms/contact`
- `POST /forms/donate-items`
- `POST /forms/request-assistance`
- `POST /forms/volunteer`
- `POST /forms/partner`
- `POST /forms/shipment-tracking`

## Payments

- `POST /payments/checkout`
- `POST /payments/webhook`

## Authenticated

- `GET /dashboard/me`

## Admin

- `GET /admin/overview`
- CRUD `/admin/current-needs`
- CRUD `/admin/campaigns`
- CRUD `/admin/sponsor-families`
- CRUD `/admin/impact-reports`
- `GET /admin/submissions`
- `PATCH /admin/submissions/:type/:id/status`
