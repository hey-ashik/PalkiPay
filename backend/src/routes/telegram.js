'use strict';

const crypto = require('crypto');
const express = require('express');
const merchants = require('../services/merchants');
const telegram = require('../services/telegram');

const router = express.Router();

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Telegram → PalkiPay webhook (one per merchant bot). */
router.post('/webhook/:userId', async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  const settings = Number.isFinite(userId) ? await merchants.getSettings(userId).catch(() => null) : null;
  if (!settings?.telegram_secret || !safeEqual(req.get('x-telegram-bot-api-secret-token'), settings.telegram_secret)) {
    return res.status(401).json({ ok: false });
  }
  // Acknowledge immediately; Telegram retries slow webhooks.
  res.json({ ok: true });
  telegram.handleUpdate(userId, req.body).catch((err) => console.error('[telegram] webhook update failed:', err.message));
});

module.exports = router;
