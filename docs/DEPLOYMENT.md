# Deploying PalkiPay on Hostinger (Business plan · Node.js app)

PalkiPay runs as **one Node.js app**: `server.js` serves both the Express API and the Next.js
website.

**The site is built on GitHub, not on Hostinger.** Hostinger’s shared servers have a system
library (glibc) that is too old for Next.js 16’s compiler, so the site cannot be *built* there,
although it runs fine:

```
you push to main ──► GitHub Actions builds on Ubuntu ──► publishes the build to the `deploy` branch
                                                                   │
Hostinger deploys main ──► server.js can’t compile ──► downloads the build made for this exact code
```

Both branches work on Hostinger:

- **`main`** (current setup): on start, `server.js` detects that it cannot compile, downloads the
  prebuilt build from `deploy` whose fingerprint (`source_hash`) matches its own code, and starts.
  If GitHub Actions is still building, it shows “PalkiPay is being prepared…” and retries every 20 s.
  A deploy takes about 1–2 minutes.
- **`deploy`**: already contains the build, so it starts immediately.

The workflow is `.github/workflows/deploy.yml` (repo → **Actions** tab shows each run, ~1 min).

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
2. Choose **Import Git repository** → connect GitHub → pick **`hey-ashik/PalkiPay`**, branch
   **`main`** (or `deploy`, see above).
3. Build settings:

   | Setting | Value |
   | --- | --- |
   | Branch | **`main`** (or `deploy`) |
   | Framework preset | **Express** (or *Other*) — not Next.js |
   | Node.js version | **22** (24 also works) |
   | Root directory | `/` (repository root) |
   | Install command | default (`npm install`) |
   | Build command | `npm run build` (on `deploy` this only checks the prebuilt site) or leave empty |
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
or the Claude Code hook) runs the GitHub Actions build, which updates `deploy`, which redeploys the site.
`/api/health` shows the live `version` (the short commit of `main` it was built from).

## Troubleshooting

`server.js` starts listening on **port 3000** immediately (Hostinger’s proxy forwards there), so
startup problems show up on the site itself instead of an opaque 503:

- **“PalkiPay is being built…”** — the frontend build was missing, so the app is building it
  (a few minutes, the page refreshes itself). Set the build command to `npm run build` to skip this.
- **“PalkiPay could not start”** — the page shows the error. Full details: `logs/server.log` and
  `logs/build.log` in the app folder (hPanel → File Manager).
- **`/api/health`** always answers with diagnostics: `database`, `migrations`, `web`
  (`starting` / `building` / `ready` / `error`), `web_error`, `warnings`, and which environment
  variables are set (`env`, true/false only — values are never shown).

| Symptom | Fix |
| --- | --- |
| “PalkiPay is being prepared…” for more than 5 minutes | Open the repo’s **Actions** tab: the latest “Build & publish deploy branch” run must be green. `/api/health` shows this server’s `source_hash`; `frontend/.next/SOURCE_HASH` on the `deploy` branch must match it. |
| Page says “no prebuilt build for this version … within 20 minutes” | The Actions run failed or didn’t run — fix it (or re-run it), then restart the app. |
| `/api/health` → `database_error` says `Access denied … (using password: YES)` on every route | The password (or user name) in the env vars doesn’t match the MySQL user. hPanel → Databases → your user → **Change password**, paste the same value into `DB_PASSWORD`, restart. |
| Still a black LiteSpeed **503** page | The Node.js process isn’t running at all: check the entry file is `server.js`, the framework preset is **Express/Other** (not Next.js), and look at the deployment log in hPanel → Deployments. Then **Restart** the app. |
| `/api/health` shows `database: error: ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER`/`DB_PASSWORD`, or the user isn’t attached to the database in hPanel. |
| `database: error: ECONNREFUSED` | Use `DB_HOST=127.0.0.1` (not `localhost`, which can resolve to IPv6 `::1`). |
| `warnings` mentions `JWT_SECRET` or `APP_URL` | Add that environment variable and restart the app. |
| Build fails with “JavaScript heap out of memory” | Redeploy; if it persists, add env var `NODE_OPTIONS=--max-old-space-size=1536`. |
| Telegram buttons do nothing | Re-save the bot token in *Dashboard → Telegram* after the domain has SSL (this registers the webhook). |

## Using the production database from your PC (optional)

hPanel → **Databases → Remote MySQL** → add your IP (or `%`) for the database. Then in your local
`.env` set `DB_HOST` to the hostname hPanel shows (e.g. `srvXXXX.hstgr.io`) with the production
credentials. Otherwise use the local database (`npm run db:start`), which keeps test data separate.
