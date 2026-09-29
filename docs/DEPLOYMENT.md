# Deploying PalkiPay on Hostinger (Business plan · Node.js app)

PalkiPay runs as **one Node.js app**: `server.js` serves both the Express API and the Next.js
website. Hostinger pulls it from GitHub, builds it and restarts it on every push to `main`.

## 1. Database (already created)

hPanel → **Databases → MySQL Databases** — you already have:

| | |
| --- | --- |
| Database | `u697802579_palkipaydb` |
| User | `u697802579_palkipayuser` |
| Host (from the Node.js app) | `127.0.0.1` |

Make sure the user is attached to the database with **All privileges**. You don’t need to import any
SQL — PalkiPay creates its tables on first start.

## 2. Create the Node.js app from GitHub

1. hPanel → **Websites → Add website → Node.js Apps** (or *Websites → Node.js* on your plan).
2. Choose **Import Git repository** → connect GitHub → pick **`hey-ashik/PalkiPay`**, branch **`main`**.
3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | **Express** (or *Other*) |
   | Node.js version | **22** (24 also works) |
   | Root directory | `/` (repository root) |
   | Install command | default (`npm install`) |
   | Build command | `npm run build` |
   | Entry file | `server.js` |
   | Start command (if asked) | `npm start` |
   | Output directory | leave empty |

4. Domain: select **palkipay.ashiik.com** (add it as a subdomain of `ashiik.com` first if needed) and
   enable **SSL**. If the domain is already attached to another website in hPanel, remove it there first.

## 3. Environment variables

In the app’s **Environment variables** section add these (the exact values are in your local
git-ignored file `.env.production.local`):

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | `https://palkipay.ashiik.com` |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `u697802579_palkipaydb` |
| `DB_USER` | `u697802579_palkipayuser` |
| `DB_PASSWORD` | *your database password* |
| `JWT_SECRET` | *long random string* (see `.env.production.local`) |
| `PAYMENT_EXPIRY_MINUTES` | `60` |
| `VERIFY_TIMEOUT_SECONDS` | `90` |

Leave `TELEGRAM_MODE` unset — with an `https://` APP_URL PalkiPay uses Telegram webhooks automatically.

> Never put these values in the repository — it is public.

## 4. Deploy & verify

1. Click **Deploy**. The first build takes a few minutes (dependency install + `next build`).
2. Open **https://palkipay.ashiik.com/api/health** — you should see `"database":"ok"`.
   The first start logs `[db] applying migration 001_initial_schema`.
3. Open **https://palkipay.ashiik.com**, register, and claim your slug.

From now on every `git push` to `main` (including the automatic pushes from `npm run autopush`
or the Claude Code hook) redeploys the site.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/health` shows `database: error: ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER`/`DB_PASSWORD`, or the user isn’t attached to the database in hPanel. |
| `database: error: ECONNREFUSED` | Use `DB_HOST=127.0.0.1` (not `localhost`, which can resolve to IPv6 `::1`). |
| Site works but payment links show `localhost` | `APP_URL` is missing — add it and restart the app. |
| Build fails with “JavaScript heap out of memory” | Redeploy; if it persists, add env var `NODE_OPTIONS=--max-old-space-size=1536`. |
| `JWT_SECRET must be set in production` in logs | Add the `JWT_SECRET` environment variable. |
| Telegram buttons do nothing | Re-save the bot token in *Dashboard → Telegram* after the domain has SSL (this registers the webhook). |

## Using the production database from your PC (optional)

hPanel → **Databases → Remote MySQL** → add your IP (or `%`) for the database. Then in your local
`.env` set `DB_HOST` to the hostname hPanel shows (e.g. `srvXXXX.hstgr.io`) with the production
credentials. Otherwise use the local database (`npm run db:start`), which keeps test data separate.
