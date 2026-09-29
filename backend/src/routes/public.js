'use strict';

const express = require('express');
const db = require('../db/pool');
const merchants = require('../services/merchants');
const slugs = require('../services/slugs');
const { PROVIDERS } = require('../services/providers');
const { HttpError, publicUrl } = require('../utils');

const router = express.Router();

router.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await db.query('SELECT 1');
  } catch (err) {
    database = `error: ${err.code || err.message}`;
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok',
    service: 'palkipay',
    database,
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
