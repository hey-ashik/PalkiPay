'use strict';

const db = require('../db/pool');
const events = require('./events');

const RETRY_DELAYS_MS = [0, 10_000, 60_000, 300_000];

/**
 * POST the payment payload to the merchant's webhook (IPN) URL.
 * Retries with back-off; the merchant should still call verify-payment before fulfilling.
 */
async function deliver({ payment, merchant, settings }, attempt = 0) {
  const url = payment.webhook_url || settings.default_webhook_url;
  if (!url) return;

  const { toApiPayload } = require('./payments');
  let ok = false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'PalkiPay-Webhook/1.0',
        'PALKIPAY-API-KEY': merchant.api_key,
        // Lets existing UddoktaPay integrations validate the request unchanged.
        'RT-UDDOKTAPAY-API-KEY': merchant.api_key,
      },
      body: JSON.stringify(toApiPayload(payment)),
      signal: AbortSignal.timeout(15_000),
      redirect: 'manual',
    });
    ok = res.status >= 200 && res.status < 300;
  } catch {
    ok = false;
  }

  const next = attempt + 1;
  const done = ok || next >= RETRY_DELAYS_MS.length;
  await db.query('UPDATE payments SET webhook_status = ?, webhook_attempts = ? WHERE id = ?', [
    ok ? 'delivered' : done ? 'failed' : 'pending',
    next,
    payment.id,
  ]);
  if (!done) {
    setTimeout(() => deliver({ payment, merchant, settings }, next).catch(() => {}), RETRY_DELAYS_MS[next]).unref();
  }
}

events.on('payment.completed', (ctx) => deliver(ctx));

module.exports = { deliver };
