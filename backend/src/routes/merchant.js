'use strict';

const express = require('express');
const config = require('../config');
const db = require('../db/pool');
const schemas = require('../validation/schemas');
const merchants = require('../services/merchants');
const payments = require('../services/payments');
const sms = require('../services/sms');
const telegram = require('../services/telegram');
const { PROVIDERS, isProvider } = require('../services/providers');
const { validate, requireAuth, requireSlug } = require('../middleware');
const { HttpError, newApiKey, newDeviceKey, newSecret, toSqlDate } = require('../utils');

const router = express.Router();
router.use(requireAuth, requireSlug);

const baseUrl = (user) => `${config.appUrl}/${user.slug}`;
const page = (q) => {
  const limit = Math.min(Math.max(Number.parseInt(q.limit, 10) || 20, 1), 100);
  const current = Math.max(Number.parseInt(q.page, 10) || 1, 1);
  return { limit, page: current, offset: (current - 1) * limit };
};

/** UTC instant of today's midnight in Dhaka (UTC+6). */
function dhakaMidnightUtc(daysAgo = 0) {
  const now = new Date(Date.now() + 6 * 3600 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 6 * 3600 * 1000 - daysAgo * 86400 * 1000);
}

// ────────────────────────────────────────────────────────────────────────────
// Overview
// ────────────────────────────────────────────────────────────────────────────

router.get('/overview', async (req, res) => {
  const uid = req.user.id;
  const today = toSqlDate(dhakaMidnightUtc(0));
  const since = toSqlDate(dhakaMidnightUtc(13));

  const [totals] = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) AS total_revenue,
       COALESCE(SUM(CASE WHEN status = 'completed' AND completed_at >= ? THEN amount END), 0) AS today_revenue,
       COALESCE(SUM(status = 'completed' AND completed_at >= ?), 0) AS today_count,
       COALESCE(SUM(status = 'completed'), 0) AS completed,
       COALESCE(SUM(status IN ('processing', 'pending')), 0) AS pending,
       COALESCE(SUM(status = 'failed'), 0) AS failed,
       COALESCE(SUM(status = 'unpaid'), 0) AS unpaid,
       COUNT(*) AS total
     FROM payments WHERE user_id = ?`,
    [today, today, uid]
  );

  const daily = await db.query(
    `SELECT DATE_FORMAT(DATE_ADD(completed_at, INTERVAL 6 HOUR), '%Y-%m-%d') AS day,
            SUM(amount) AS revenue, COUNT(*) AS count
     FROM payments WHERE user_id = ? AND status = 'completed' AND completed_at >= ?
     GROUP BY day ORDER BY day`,
    [uid, since]
  );
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const chart = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(dhakaMidnightUtc(i).getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
    const row = byDay.get(day);
    chart.push({ day, revenue: row ? Number(row.revenue) : 0, count: row ? Number(row.count) : 0 });
  }

  const providers = await db.query(
    `SELECT payment_method AS provider, SUM(amount) AS revenue, COUNT(*) AS count
     FROM payments WHERE user_id = ? AND status = 'completed' GROUP BY payment_method ORDER BY revenue DESC`,
    [uid]
  );
  const recent = await db.query('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', [uid]);
  const [devices] = await db.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(last_seen_at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE), 0) AS online
     FROM devices WHERE user_id = ? AND is_active = 1`,
    [uid]
  );
  const [smsCounts] = await db.query(
    `SELECT COALESCE(SUM(status = 'unused'), 0) AS unused, COALESCE(SUM(status = 'used'), 0) AS used,
            COALESCE(SUM(status = 'invalid'), 0) AS invalid
     FROM sms_messages WHERE user_id = ?`,
    [uid]
  );

  const num = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v)]));
  res.json({
    status: true,
    totals: num(totals),
    chart,
    providers: providers.map((p) => ({ provider: p.provider, revenue: Number(p.revenue), count: Number(p.count) })),
    recent: recent.map(payments.toDashboard),
    devices: num(devices),
    sms: num(smsCounts),
    base_url: baseUrl(req.user),
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Payments
// ────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = {
  completed: ['completed'],
  pending: ['processing', 'pending'],
  failed: ['failed'],
  unpaid: ['unpaid'],
  closed: ['cancelled', 'expired'],
};

router.get('/payments', async (req, res) => {
  const { limit, offset, page: current } = page(req.query);
  const where = ['user_id = ?'];
  const params = [req.user.id];

  const filter = STATUS_FILTERS[req.query.status];
  if (filter) {
    where.push(`status IN (${filter.map(() => '?').join(', ')})`);
    params.push(...filter);
  }
  if (isProvider(req.query.provider)) {
    where.push('payment_method = ?');
    params.push(req.query.provider);
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(invoice_id LIKE ? OR transaction_id LIKE ? OR full_name LIKE ? OR email LIKE ? OR sender_number LIKE ?)');
    params.push(like, like, like, like, like);
  }

  const sqlWhere = where.join(' AND ');
  const rows = await db.query(
    `SELECT * FROM payments WHERE ${sqlWhere} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM payments WHERE ${sqlWhere}`, params);
  const [counts] = await db.query(
    `SELECT COUNT(*) AS \`all\`, COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(status IN ('processing', 'pending')), 0) AS pending,
            COALESCE(SUM(status = 'failed'), 0) AS failed, COALESCE(SUM(status = 'unpaid'), 0) AS unpaid,
            COALESCE(SUM(status IN ('cancelled', 'expired')), 0) AS closed
     FROM payments WHERE user_id = ?`,
    [req.user.id]
  );

  res.json({
    status: true,
    data: rows.map(payments.toDashboard),
    pagination: { page: current, limit, total: Number(total), pages: Math.max(1, Math.ceil(Number(total) / limit)) },
    counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
  });
});

/** Create a shareable payment link from the dashboard (no integration needed). */
router.post('/payments', validate(schemas.createLink), async (req, res) => {
  const result = await payments.createPayment(req.user, req.body, 'link');
  res.status(201).json({ status: true, message: 'Payment link created.', ...result });
});

async function ownPayment(req) {
  const payment = await payments.getByInvoice(req.params.invoiceId);
  if (!payment || payment.user_id !== req.user.id) throw new HttpError(404, 'Payment not found.');
  return payment;
}

router.get('/payments/:invoiceId', async (req, res) => {
  const payment = await payments.refresh(await ownPayment(req));
  const linkedSms = payment.sms_id ? await db.one('SELECT * FROM sms_messages WHERE id = ?', [payment.sms_id]) : null;
  res.json({
    status: true,
    payment: payments.toDashboard(payment),
    sms: linkedSms ? sms.toPublic(linkedSms) : null,
    checkout_url: payments.checkoutUrl(req.user.slug, payment.invoice_id),
  });
});

router.post('/payments/:invoiceId/approve', async (req, res) => {
  const payment = await payments.approvePayment(await ownPayment(req), { by: 'dashboard' });
  res.json({ status: true, message: 'Payment approved.', payment: payments.toDashboard(payment) });
});

router.post('/payments/:invoiceId/reject', validate(schemas.reject), async (req, res) => {
  const payment = await payments.rejectPayment(await ownPayment(req), { by: 'dashboard', reason: req.body.reason });
  res.json({ status: true, message: 'Payment rejected.', payment: payments.toDashboard(payment) });
});

// ────────────────────────────────────────────────────────────────────────────
// SMS inbox
// ────────────────────────────────────────────────────────────────────────────

router.get('/sms', async (req, res) => {
  const { limit, offset, page: current } = page(req.query);
  const where = ['s.user_id = ?'];
  const params = [req.user.id];
  if (['unused', 'used', 'invalid'].includes(req.query.status)) {
    where.push('s.status = ?');
    params.push(req.query.status);
  }
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push('(s.transaction_id LIKE ? OR s.from_number LIKE ? OR s.body LIKE ?)');
    params.push(like, like, like);
  }
  const sqlWhere = where.join(' AND ');
  const rows = await db.query(
    `SELECT s.*, d.name AS device_name, p.invoice_id FROM sms_messages s
     LEFT JOIN devices d ON d.id = s.device_id
     LEFT JOIN payments p ON p.id = s.payment_id
     WHERE ${sqlWhere} ORDER BY s.received_at DESC, s.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM sms_messages s WHERE ${sqlWhere}`, params);
  res.json({
    status: true,
    data: rows.map((r) => ({ ...sms.toPublic(r), device_name: r.device_name, invoice_id: r.invoice_id })),
    pagination: { page: current, limit, total: Number(total), pages: Math.max(1, Math.ceil(Number(total) / limit)) },
  });
});

/**
 * Simulate an incoming wallet SMS — lets merchants test the full flow before
 * installing the forwarding app. It goes through exactly the same pipeline.
 */
router.post('/sms/simulate', validate(schemas.smsSimulate), async (req, res) => {
  const { provider, amount, transaction_id: trx, from_number: from } = req.body;
  const amt = amount.toFixed(2);
  const now = new Date(Date.now() + 6 * 3600 * 1000);
  const stamp = `${now.toISOString().slice(8, 10)}/${now.toISOString().slice(5, 7)}/${now.toISOString().slice(0, 4)} ${now.toISOString().slice(11, 16)}`;
  const templates = {
    bkash: [`bKash`, `You have received Tk ${amt} from ${from}. Fee Tk 0.00. Balance Tk ${amt}. TrxID ${trx} at ${stamp}`],
    nagad: [`NAGAD`, `Money Received.\nAmount: Tk ${amt}\nSender: ${from}\nRef: N/A\nTxnID: ${trx}\nBalance: Tk ${amt}\n${stamp}`],
    rocket: [`16216`, `Tk${amt} received from A/C:${from} Fee:Tk0, Your A/C Balance: Tk${amt} TxnId:${trx} Date:${stamp}`],
    upay: [`upay`, `You have received Tk. ${amt} from ${from}. TrxID: ${trx}. Balance Tk. ${amt}`],
  };
  const [sender, body] = templates[provider];
  const result = await sms.ingestSms({ merchantId: req.user.id, sender, body });
  res.status(result.status === 'stored' ? 201 : 200).json({
    status: result.status === 'stored',
    result: result.status,
    message:
      result.status === 'stored'
        ? result.payment
          ? `SMS stored and matched invoice ${result.payment.invoice_id} (${result.payment.status}).`
          : 'SMS stored. It will match the payment that uses this transaction ID.'
        : result.reason,
    sms: result.sms ? sms.toPublic(result.sms) : null,
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Payment methods (wallet numbers)
// ────────────────────────────────────────────────────────────────────────────

router.get('/payment-methods', async (req, res) => {
  const rows = await db.query('SELECT * FROM payment_methods WHERE user_id = ?', [req.user.id]);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  res.json({
    status: true,
    data: Object.values(PROVIDERS).map((p) => {
      const row = byProvider.get(p.id);
      return {
        provider: p.id,
        name: p.name,
        configured: Boolean(row),
        account_type: row?.account_type || 'personal',
        account_number: row?.account_number || '',
        is_active: Boolean(row?.is_active),
        updated_at: row?.updated_at || null,
      };
    }),
  });
});

router.put('/payment-methods/:provider', validate(schemas.paymentMethod), async (req, res) => {
  if (!isProvider(req.params.provider)) throw new HttpError(404, 'Unknown payment method.');
  const { account_type, account_number, is_active } = req.body;
  await db.query(
    `INSERT INTO payment_methods (user_id, provider, account_type, account_number, is_active)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE account_type = VALUES(account_type), account_number = VALUES(account_number),
       is_active = VALUES(is_active)`,
    [req.user.id, req.params.provider, account_type, account_number, is_active ? 1 : 0]
  );
  res.json({ status: true, message: `${PROVIDERS[req.params.provider].name} saved.` });
});

router.delete('/payment-methods/:provider', async (req, res) => {
  await db.query('DELETE FROM payment_methods WHERE user_id = ? AND provider = ?', [req.user.id, req.params.provider]);
  res.json({ status: true, message: 'Payment method removed.' });
});

// ────────────────────────────────────────────────────────────────────────────
// Devices
// ────────────────────────────────────────────────────────────────────────────

const deviceView = (d) => ({
  id: d.id,
  name: d.name,
  platform: d.platform,
  device_key: d.device_key,
  is_active: Boolean(d.is_active),
  app_version: d.app_version,
  last_seen_at: d.last_seen_at,
  online: Boolean(d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 15 * 60 * 1000),
  created_at: d.created_at,
});

router.get('/devices', async (req, res) => {
  const rows = await db.query(
    `SELECT d.*, (SELECT COUNT(*) FROM sms_messages s WHERE s.device_id = d.id) AS sms_count
     FROM devices d WHERE d.user_id = ? ORDER BY d.created_at DESC`,
    [req.user.id]
  );
  res.json({
    status: true,
    data: rows.map((d) => ({ ...deviceView(d), sms_count: Number(d.sms_count) })),
    endpoints: {
      base_url: baseUrl(req.user),
      sms_url: `${baseUrl(req.user)}/api/device/sms`,
      login_url: `${baseUrl(req.user)}/api/device/login`,
    },
  });
});

router.post('/devices', validate(schemas.device), async (req, res) => {
  const [{ n }] = await db.query('SELECT COUNT(*) AS n FROM devices WHERE user_id = ?', [req.user.id]);
  if (n >= 10) throw new HttpError(422, 'You can register up to 10 devices.');
  const result = await db.query('INSERT INTO devices (user_id, name, platform, device_key) VALUES (?, ?, ?, ?)', [
    req.user.id,
    req.body.name,
    req.body.platform,
    newDeviceKey(),
  ]);
  const device = await db.one('SELECT * FROM devices WHERE id = ?', [result.insertId]);
  res.status(201).json({ status: true, message: 'Device added.', device: deviceView(device) });
});

async function ownDevice(req) {
  const device = await db.one('SELECT * FROM devices WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!device) throw new HttpError(404, 'Device not found.');
  return device;
}

router.patch('/devices/:id', validate(schemas.deviceUpdate), async (req, res) => {
  const device = await ownDevice(req);
  await db.query('UPDATE devices SET name = ?, is_active = ? WHERE id = ?', [
    req.body.name ?? device.name,
    req.body.is_active === undefined ? device.is_active : req.body.is_active ? 1 : 0,
    device.id,
  ]);
  res.json({ status: true, message: 'Device updated.', device: deviceView(await ownDevice(req)) });
});

router.post('/devices/:id/regenerate', async (req, res) => {
  const device = await ownDevice(req);
  await db.query('UPDATE devices SET device_key = ? WHERE id = ?', [newDeviceKey(), device.id]);
  res.json({ status: true, message: 'New device key generated. Update it on the phone.', device: deviceView(await ownDevice(req)) });
});

router.delete('/devices/:id', async (req, res) => {
  const device = await ownDevice(req);
  await db.query('DELETE FROM devices WHERE id = ?', [device.id]);
  res.json({ status: true, message: 'Device removed.' });
});

// ────────────────────────────────────────────────────────────────────────────
// Brand settings
// ────────────────────────────────────────────────────────────────────────────

router.get('/settings/brand', async (req, res) => {
  const s = await merchants.getSettings(req.user.id);
  res.json({
    status: true,
    data: {
      brand_name: s.brand_name || req.user.name,
      brand_logo: s.brand_logo,
      support_phone: s.support_phone,
      support_email: s.support_email,
      default_webhook_url: s.default_webhook_url,
    },
  });
});

router.put('/settings/brand', validate(schemas.brand), async (req, res) => {
  const b = req.body;
  await merchants.getSettings(req.user.id);
  await db.query(
    `UPDATE merchant_settings SET brand_name = ?, brand_logo = ?, support_phone = ?, support_email = ?,
       default_webhook_url = ? WHERE user_id = ?`,
    [b.brand_name, b.brand_logo ?? null, b.support_phone, b.support_email, b.default_webhook_url, req.user.id]
  );
  res.json({ status: true, message: 'Brand settings saved.' });
});

// ────────────────────────────────────────────────────────────────────────────
// API integration
// ────────────────────────────────────────────────────────────────────────────

router.get('/integration', async (req, res) => {
  const base = baseUrl(req.user);
  res.json({
    status: true,
    api_key: req.user.api_key,
    base_url: base,
    endpoints: {
      create_payment: `${base}/api/checkout-v2`,
      verify_payment: `${base}/api/verify-payment`,
    },
  });
});

router.post('/integration/regenerate-key', async (req, res) => {
  const apiKey = newApiKey();
  await db.query('UPDATE users SET api_key = ? WHERE id = ?', [apiKey, req.user.id]);
  res.json({ status: true, message: 'New API key generated. Update it in your store.', api_key: apiKey });
});

// ────────────────────────────────────────────────────────────────────────────
// Telegram
// ────────────────────────────────────────────────────────────────────────────

function telegramView(s) {
  return {
    connected: Boolean(s.telegram_bot_token),
    enabled: Boolean(s.telegram_enabled),
    bot_username: s.telegram_bot_username,
    chat_id: s.telegram_chat_id,
    chat_linked: Boolean(s.telegram_chat_id),
    link_url: telegram.deepLink(s),
    mode: config.telegram.mode,
  };
}

router.get('/telegram', async (req, res) => {
  res.json({ status: true, data: telegramView(await merchants.getSettings(req.user.id)) });
});

router.put('/telegram', validate(schemas.telegram), async (req, res) => {
  const current = await merchants.getSettings(req.user.id);
  const { bot_token: botToken, chat_id: chatId, enabled } = req.body;
  const updates = {};

  if (botToken && botToken !== current.telegram_bot_token) {
    let me;
    try {
      me = await telegram.call(botToken, 'getMe');
    } catch {
      throw new HttpError(422, 'Telegram rejected this bot token. Copy it again from @BotFather.', {
        bot_token: 'Invalid bot token',
      });
    }
    if (current.telegram_bot_token) await telegram.deactivate(req.user.id, current.telegram_bot_token);
    Object.assign(updates, {
      telegram_bot_token: botToken,
      telegram_bot_username: me.username,
      telegram_secret: newSecret(),
      telegram_chat_id: null,
      telegram_enabled: 1,
    });
  }
  if (chatId !== undefined) updates.telegram_chat_id = chatId;
  if (enabled !== undefined) updates.telegram_enabled = enabled ? 1 : 0;

  const keys = Object.keys(updates);
  if (keys.length) {
    await db.query(`UPDATE merchant_settings SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE user_id = ?`, [
      ...keys.map((k) => updates[k]),
      req.user.id,
    ]);
  }

  const settings = await merchants.getSettings(req.user.id);
  if (updates.telegram_bot_token) {
    try {
      await telegram.activate(req.user.id, settings);
    } catch (err) {
      throw new HttpError(502, `Bot saved, but Telegram could not be reached: ${err.message}`);
    }
  }
  res.json({ status: true, message: 'Telegram settings saved.', data: telegramView(settings) });
});

router.post('/telegram/test', async (req, res) => {
  const settings = await merchants.getSettings(req.user.id);
  if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
    throw new HttpError(422, 'Connect your bot and link a chat first.');
  }
  try {
    await telegram.sendTest(settings);
  } catch (err) {
    throw new HttpError(502, `Telegram error: ${err.message}`);
  }
  res.json({ status: true, message: 'Test message sent. Check Telegram.' });
});

router.delete('/telegram', async (req, res) => {
  const settings = await merchants.getSettings(req.user.id);
  await telegram.deactivate(req.user.id, settings.telegram_bot_token);
  await db.query(
    `UPDATE merchant_settings SET telegram_bot_token = NULL, telegram_bot_username = NULL, telegram_chat_id = NULL,
       telegram_secret = NULL, telegram_enabled = 0 WHERE user_id = ?`,
    [req.user.id]
  );
  res.json({ status: true, message: 'Telegram disconnected.' });
});

module.exports = router;
