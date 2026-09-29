# PalkiPay — Build Roadmap

Progress tracker. If a development session stops midway, continue from the first unchecked item.

## Phase 1 — Core platform
- [x] Monorepo structure (`frontend/`, `backend/`, root `server.js` running both)
- [x] MySQL schema with automatic migrations on startup
- [x] Auth: register / login / logout / profile / password (JWT in httpOnly cookie)
- [x] Unique permanent merchant slug (`palkipay.ashiik.com/<slug>`) with live availability check + suggestions
- [x] Payment methods: bKash, Nagad, Rocket, Upay (personal / agent numbers)
- [x] Merchant API (UddoktaPay-compatible): `checkout-v2`, `verify-payment`, API-key auth bound to slug
- [x] SMS parser (bKash, Nagad, Rocket, Upay) + tests
- [x] Verification engine: instant match, late-SMS match, insufficient amount, TrxID reuse protection, timeout → manual review
- [x] Device API for Android app / iOS Shortcut (`/api/device/*`)
- [x] Telegram bot: notifications + Approve/Reject buttons (webhook in production, polling locally)
- [x] Merchant webhooks (IPN) with retries
- [x] End-to-end API test (45 checks)

## Phase 2 — Web app
- [ ] Design system (UddoktaPay-inspired: Plus Jakarta Sans, blue gradient)
- [ ] Landing page
- [ ] Login / Register (with slug picker) / Onboarding
- [ ] Dashboard: overview, transactions, payment links, SMS inbox, devices, payment methods, API, Telegram, settings
- [ ] Hosted checkout with bKash / Nagad / Rocket / Upay styled screens, loading + result states
- [ ] Public merchant page + API docs page

## Phase 3 — Ship
- [ ] Auto-push script + Claude Code hook
- [ ] README + deployment guide (Hostinger Node.js app from GitHub)
- [ ] Production build verified locally

## Later
- [ ] Android SMS-forwarder app (Dashboard / Filters / Settings, like Paymently) — backend API ready
- [ ] Platform super-admin panel
- [ ] Password reset by email (needs SMTP)
