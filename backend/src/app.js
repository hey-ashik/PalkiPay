'use strict';

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware');
const { runMigrations } = require('./db/migrate');
const payments = require('./services/payments');
const telegram = require('./services/telegram');
require('./services/webhooks'); // registers the merchant-webhook listener

/** Middleware shared by every API router (kept off Next.js page routes). */
function apiBase() {
  const router = express.Router({ mergeParams: true });
  router.use(helmet({ crossOriginResourcePolicy: false }));
  router.use(morgan(config.isProd ? 'short' : 'dev'));
  router.use(express.json({ limit: '1mb' }));
  router.use(express.urlencoded({ extended: false, limit: '1mb' }));
  router.use(cookieParser());
  return router;
}

/**
 * Builds the Express app with all API routes:
 *   /api/...          platform API (auth, dashboard, checkout, device, telegram, gateway)
 *   /:slug/api/...    per-merchant base URL (gateway + device API)
 * Anything else falls through, so the caller can hand it to Next.js.
 */
function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const api = apiBase();
  api.use('/auth', require('./routes/auth'));
  api.use('/merchant', require('./routes/merchant'));
  api.use('/checkout', require('./routes/checkout'));
  api.use('/device', require('./routes/device'));
  api.use('/telegram', require('./routes/telegram'));
  api.use('/', require('./routes/public'));
  api.use('/', require('./routes/gateway'));
  api.use(notFound);
  api.use(errorHandler);

  const slugApi = apiBase();
  slugApi.use('/device', require('./routes/device'));
  slugApi.use('/', require('./routes/gateway'));
  slugApi.use(notFound);
  slugApi.use(errorHandler);

  app.use('/api', api);
  app.use('/:slug/api', slugApi);
  return app;
}

/**
 * Database migrations + background jobs. Retries until the database is reachable
 * so a temporary DB outage never takes the website down.
 */
async function startBackground({ retryMs = 30_000 } = {}) {
  for (;;) {
    try {
      await runMigrations();
      break;
    } catch (err) {
      console.error(`[db] cannot prepare database (${err.code || err.message}) — retrying in ${retryMs / 1000}s`);
      await new Promise((r) => setTimeout(r, retryMs).unref?.());
    }
  }
  payments.startSweeper();
  await telegram.bootstrap().catch((err) => console.error('[telegram] bootstrap failed:', err.message));
}

module.exports = { createApp, startBackground };
