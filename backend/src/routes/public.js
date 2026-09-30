'use strict';

const express = require('express');
const config = require('../config');
const db = require('../db/pool');
const runtime = require('../runtime');
const merchants = require('../services/merchants');
const slugs = require('../services/slugs');
const { PROVIDERS } = require('../services/providers');
const { HttpError, publicUrl } = require('../utils');

const router = express.Router();

/**
 * Health + deployment diagnostics. Always answers 200 so hosting proxies never
 * replace the body with their own error page. Reports which settings are present
 * (never their values).
 */
router.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    database = `error: ${err.code || err.message}`;
  }
  const s = runtime.state;
  const env = Object.fromEntries(
    ['APP_URL', 'JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].map((k) => [k, Boolean(process.env[k])])
  );
  res.set('Cache-Control', 'no-store').json({
    status: database === 'ok' && s.web === 'ready',
    service: 'palkipay',
    version: s.version || 'source',
    built_at: s.builtAt || null,
    source_hash: s.sourceHash || null,
    database,
    // Not secret, and the quickest way to spot a typo in the hosting panel. The password is never shown.
    database_config: { host: config.db.host, port: config.db.port, name: config.db.name, user: config.db.user },
    database_via: s.databaseVia || null,
    database_error: database === 'ok' ? null : s.databaseError,
    migrations: s.database,
    web: s.web,
    web_error: s.webError,
    warnings: s.warnings,
    env,
    node: process.version,
    ports: s.ports,
    started_at: s.startedAt,
    time: new Date().toISOString(),
  });
});

router.get('/config', (req, res) => {
  res.json({
    status: true,
    app_url: publicUrl(req),
    providers: Object.values(PROVIDERS).map(({ id, name, ussd }) => ({ id, name, ussd })),
  });
});

/** Live availability check for the "choose your URL" field. */
router.get('/slugs/check', async (req, res) => {
  res.json({ status: true, ...(await slugs.check(req.query.slug)) });
});

/** Public merchant profile for palkipay.ashiik.com/<slug>. */
router.get('/merchants/:slug', async (req, res) => {
  const merchant = await merchants.findBySlug(req.params.slug);
  if (!merchant || merchant.status !== 'active') throw new HttpError(404, 'Merchant not found.');
  const settings = await merchants.getSettings(merchant.id);
  const methods = await merchants.getActiveMethods(merchant.id);
  res.json({
    status: true,
    merchant: merchants.publicBrand(merchant, settings),
    providers: methods.map((m) => m.provider),
  });
});

module.exports = router;
