'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const schemas = require('../validation/schemas');
const sms = require('../services/sms');
const { validate, requireDevice, limits } = require('../middleware');
const { HttpError, newDeviceKey, publicUrl } = require('../utils');

/**
 * API for the SMS-forwarding companion apps (Android app, iOS Shortcut).
 * Mounted at /api/device and /:slug/api/device.
 */
const router = express.Router({ mergeParams: true });

const merchantInfo = (merchant, req) => ({
  name: merchant.name,
  slug: merchant.slug,
  base_url: `${publicUrl(req)}/${merchant.slug}`,
});

/** Sign in from the app with dashboard credentials → a new device + its key. */
router.post('/login', limits.auth, validate(schemas.deviceLogin), async (req, res) => {
  const { email, password, device_name: name, platform, app_version: appVersion } = req.body;
  const user = await db.one('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Incorrect email or password.');
  }
  if (user.status !== 'active') throw new HttpError(403, 'This account is suspended.');
  if (!user.slug) throw new HttpError(409, 'Finish setting up your account on the website first.');
  if (req.params.slug && req.params.slug.toLowerCase() !== user.slug) {
    throw new HttpError(401, 'This account does not belong to this base URL.');
  }

  const deviceKey = newDeviceKey();
  await db.query(
    'INSERT INTO devices (user_id, name, platform, device_key, app_version, last_seen_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())',
    [user.id, name, platform, deviceKey, appVersion || null]
  );
  res.status(201).json({ status: true, device_key: deviceKey, merchant: merchantInfo(user, req) });
});

router.use(requireDevice, limits.device);

router.get('/me', (req, res) => {
  const d = req.device;
  res.json({
    status: true,
    device: { id: d.id, name: d.name, platform: d.platform, is_active: Boolean(d.is_active) },
    merchant: merchantInfo(req.merchant, req),
  });
});

router.post('/heartbeat', async (req, res) => {
  const version = typeof req.body?.app_version === 'string' ? req.body.app_version.slice(0, 20) : null;
  if (version) await db.query('UPDATE devices SET app_version = ? WHERE id = ?', [version, req.device.id]);
  res.json({ status: true, time: new Date().toISOString() });
});

async function ingest(req, item) {
  const result = await sms.ingestSms({
    merchantId: req.merchant.id,
    deviceId: req.device.id,
    sender: item.sender,
    body: item.message,
    receivedAt: item.received_at,
    providerHint: item.provider,
  });
  return {
    result: result.status,
    reason: result.reason || null,
    sms_id: result.sms?.id || null,
    provider: result.sms?.provider || null,
    transaction_id: result.sms?.transaction_id || null,
    amount: result.sms?.amount == null ? null : Number(result.sms.amount),
    matched_invoice: result.payment?.invoice_id || null,
    payment_status: result.payment?.status || null,
  };
}

/** Forward one SMS. Always 200 for well-formed requests so apps don't retry parse failures. */
router.post('/sms', validate(schemas.smsIn), async (req, res) => {
  const outcome = await ingest(req, req.body);
  res.json({ status: outcome.result !== 'invalid', ...outcome });
});

/** Forward a batch of SMS (offline sync). */
router.post('/sms/bulk', async (req, res) => {
  const items = Array.isArray(req.body?.messages) ? req.body.messages.slice(0, 100) : [];
  if (!items.length) throw new HttpError(422, 'messages must be a non-empty array.');
  const results = [];
  for (const raw of items) {
    const parsed = schemas.smsIn.safeParse(raw);
    results.push(parsed.success ? await ingest(req, parsed.data) : { result: 'invalid', reason: parsed.error.issues[0].message });
  }
  res.json({ status: true, results });
});

router.get('/stats', async (req, res) => {
  const [row] = await db.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'unused'), 0) AS unused,
            COALESCE(SUM(status = 'used'), 0) AS used, COALESCE(SUM(status = 'invalid'), 0) AS invalid
     FROM sms_messages WHERE device_id = ?`,
    [req.device.id]
  );
  res.json({ status: true, stats: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) });
});

router.get('/messages', async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 50, 200);
  const params = [req.device.id];
  let where = 'device_id = ?';
  if (['unused', 'used', 'invalid'].includes(req.query.status)) {
    where += ' AND status = ?';
    params.push(req.query.status);
  }
  const rows = await db.query(`SELECT * FROM sms_messages WHERE ${where} ORDER BY id DESC LIMIT ?`, [...params, limit]);
  res.json({ status: true, data: rows.map(sms.toPublic) });
});

module.exports = router;
