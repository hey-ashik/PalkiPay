# PalkiPay

Automated **bKash, Nagad, Rocket & Upay** payment gateway for Bangladeshi businesses.
Merchants accept payments on their own personal/agent wallet numbers; a phone forwards the
wallet SMS and PalkiPay verifies each payment automatically by Transaction ID and amount.

- **Live:** https://palkipay.ashiik.com
- **Each merchant gets one permanent URL:** `palkipay.ashiik.com/<slug>`

## Features

| Area | What you get |
| --- | --- |
| Merchant accounts | Register/login, one unique slug per account (live availability check + suggestions) |
| Dashboard `/<slug>/dashboard` | Revenue overview, transactions (approve/reject), payment links, SMS inbox, devices, payment methods, API keys, Telegram, branding |
| Hosted checkout `/<slug>/checkout/<invoice>` | bKash/Nagad/Rocket/Upay styled screens, copy-number/amount, live verification, success/review/failed states, redirect back to the store |
| Verification engine | Instant match, late-SMS match, insufficient-amount detection, one-time Transaction IDs, timeout → manual review |
| Merchant API | UddoktaPay-compatible `checkout-v2` + `verify-payment`, webhooks with retries |
| SMS forwarding | Device API for the Android app (coming) and an iOS Shortcut automation |
| Telegram | Notifications for every payment, Approve/Reject buttons for payments that need review |

## Project structure

```
PalkiPay/
├── server.js              # Production/dev entry — runs Express API + Next.js in ONE process
├── package.json           # npm workspaces + root scripts
├── backend/               # Express 5 + MySQL (mysql2)
│   ├── src/
│   │   ├── app.js         # Express app (API routers only)
│   │   ├── index.js       # Stand-alone API server (optional)
│   │   ├── config/        # Environment config
│   │   ├── db/            # Pool, migrations (auto-run on start)
│   │   ├── middleware/    # Auth, API key, device key, validation, rate limits, errors
│   │   ├── routes/        # auth, merchant, checkout, gateway, device, telegram, public
│   │   ├── services/      # payments engine, SMS parser, Telegram, webhooks, slugs
│   │   └── validation/    # zod schemas
│   └── tests/             # node:test unit tests
├── frontend/              # Next.js 16 (App Router) + Tailwind CSS 4
│   └── src/
│       ├── app/           # Pages: landing, auth, [slug]/dashboard/*, [slug]/checkout/*, docs
│       ├── components/    # UI kit, dashboard, checkout, marketing
│       └── lib/           # API client, types, formatting, providers
├── scripts/
│   ├── auto-push.js       # Commit + push to GitHub (one-shot or --watch), blocks secrets
│   └── local-db.js        # Portable local MariaDB for Windows
└── docs/
    ├── DEPLOYMENT.md      # Hostinger step-by-step
    └── ROADMAP.md         # Progress tracker
```

## Run locally

Requirements: **Node.js 20.9+** (22 or 24 recommended).

```bash
npm install                 # installs backend + frontend (workspaces)
cp .env.example .env        # then edit DB_* and JWT_SECRET
npm run db:start            # Windows: starts a portable MariaDB (downloads once, ~90 MB)
npm run dev                 # http://localhost:3000 — API + web app, hot reload
```

Database tables are created automatically on startup. Don’t have MySQL and not on Windows?
Install MySQL/MariaDB (or XAMPP), create an empty database, and put its credentials in `.env`.

**Try the whole flow without a phone:** register → *Payment methods* (add a bKash number) →
*Payment links* (create a link and open it) → *SMS inbox → Send test SMS* with the same amount and a
Transaction ID → submit that Transaction ID on the checkout page.

### Useful scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server (API + web) on port 3000 |
| `npm run build` | Production build of the frontend |
| `npm start` | Production server (after `npm run build`) |
| `npm run db:start` / `db:stop` | Start/stop the portable local database (Windows) |
| `npm run migrate` | Run database migrations manually |
| `npm test` | Backend unit tests |
| `npm run push` | Commit everything and push to GitHub now |
| `npm run autopush` | Watch the project and push automatically after changes |

## Deploy

Push to `main` → Hostinger rebuilds and restarts the app automatically.
First-time setup (Node.js app, environment variables, domain): see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Integrate a store

```bash
curl -X POST "https://palkipay.ashiik.com/<slug>/api/checkout-v2" \
  -H "Content-Type: application/json" \
  -H "PALKIPAY-API-KEY: <your API key>" \
  -d '{"full_name":"Rahim","email":"r@example.com","amount":"500","redirect_url":"https://shop.com/ok","cancel_url":"https://shop.com/cart"}'
```

Full reference: `/docs` on the site, or *Dashboard → API & integration* for code samples.

## Security notes

- The repository is **public**: secrets live only in `.env` (local) and Hostinger environment variables.
  `scripts/auto-push.js` refuses to commit if any secret value from your `.env*` files appears in a change.
- Passwords are hashed with bcrypt; sessions are httpOnly JWT cookies; auth, checkout and API routes are rate-limited.
- API keys are bound to the merchant’s slug; device keys can be paused or rotated per phone.
