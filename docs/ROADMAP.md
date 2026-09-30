# PalkiPay — Build Roadmap

Progress tracker. If a development session stops midway, continue from the first unchecked item.

## Phase 1 — Core platform ✅
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

## Phase 2 — Web app ✅
- [x] Design system (UddoktaPay-inspired: Plus Jakarta Sans, blue gradient, Noto Sans Bengali for ৳)
- [x] Landing page
- [x] Login / Register (with slug picker) / Onboarding
- [x] Dashboard: overview, transactions, payment links, SMS inbox, devices, payment methods, API, Telegram, settings
- [x] Hosted checkout with bKash / Nagad / Rocket / Upay styled screens, loading + result states
- [x] Public merchant page + API docs page

## Phase 3 — Ship ✅
- [x] Auto-push script (`npm run push`, `npm run autopush`) with secret guard + Claude Code Stop hook (local)
- [x] Portable local database (`npm run db:start`)
- [x] README + Hostinger deployment guide (`docs/DEPLOYMENT.md`)
- [x] Production build + unified `npm start` verified locally

### Verification done
- 8 SMS-parser unit tests (`npm test`)
- 45-check end-to-end API test (auth, slugs, checkout, SMS matching, approve/reject, device API)
- 19-check Telegram/timeout integration test (mocked Telegram API, real DB + webhook receiver)
- Browser journey in headless Chrome on the production build: register → dashboard → checkout success & insufficient — no console errors

## Next up
- [ ] First deploy on Hostinger + set environment variables (manual, see `docs/DEPLOYMENT.md`)
- [ ] Android SMS-forwarder app (Dashboard / Filters / Settings, like Paymently) — backend API ready
- [ ] Platform super-admin panel (list merchants, suspend accounts)
- [ ] Password reset by email (needs SMTP credentials)
- [ ] Optional: bank transfer / card methods, multi-number rotation per wallet
