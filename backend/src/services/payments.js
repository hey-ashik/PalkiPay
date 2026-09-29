'use strict';

const db = require('../db/pool');
const config = require('../config');
const events = require('./events');
const merchants = require('./merchants');
const { PROVIDERS } = require('./providers');
const {
  newInvoiceId,
  HttpError,
  toPaisa,
  formatAmount,
  normalizePhone,
  normalizeTrxId,
  toSqlDate,
  parseJson,
} = require('../utils');

/** Statuses that can no longer change on their own. */
const FINAL_STATUSES = ['completed', 'failed', 'cancelled', 'expired'];
/** Statuses that are waiting for a matching SMS. */
const AWAITING_SMS = ['processing', 'pending'];

const checkoutUrl = (slug, invoiceId) => `${config.appUrl}/${slug}/checkout/${invoiceId}`;

/** Bangladesh is UTC+6 all year (no DST). */
function dhakaDate(value) {
  if (!value) return null;
  const d = new Date(new Date(value).getTime() + 6 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function getById(id) {
  return db.one('SELECT * FROM payments WHERE id = ?', [id]);
}

async function getByInvoice(invoiceId) {
  return db.one('SELECT * FROM payments WHERE invoice_id = ?', [String(invoiceId || '')]);
}

async function loadMerchant(payment) {
  const merchant = await merchants.findById(payment.user_id);
  const settings = await merchants.getSettings(payment.user_id);
  return { merchant, settings };
}

// ────────────────────────────────────────────────────────────────────────────
// Create
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param merchant  users row
 * @param input     validated { full_name, email, amount, metadata, redirect_url, cancel_url,
 *                              webhook_url, return_type, description }
 */
async function createPayment(merchant, input, source = 'api') {
  if (!merchant.slug) {
    throw new HttpError(400, 'Finish your PalkiPay account setup (choose a URL slug) before accepting payments.');
  }
  const methods = await merchants.getActiveMethods(merchant.id);
  if (!methods.length) {
    throw new HttpError(400, 'No payment method is active. Add a bKash, Nagad, Rocket or Upay number in the dashboard first.');
  }

  const invoiceId = newInvoiceId();
  const expiresAt = new Date(Date.now() + config.payments.expiryMinutes * 60 * 1000);
  const metadata = input.metadata == null ? null : JSON.stringify(input.metadata);

  await db.query(
    `INSERT INTO payments
      (user_id, invoice_id, source, full_name, email, amount, description, metadata,
       redirect_url, cancel_url, webhook_url, return_type, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      merchant.id,
      invoiceId,
      source,
      input.full_name,
      input.email || null,
      formatAmount(input.amount),
      input.description || null,
      metadata,
      input.redirect_url || null,
      input.cancel_url || null,
      input.webhook_url || null,
      input.return_type || 'GET',
      toSqlDate(expiresAt),
    ]
  );

  return { invoice_id: invoiceId, payment_url: checkoutUrl(merchant.slug, invoiceId) };
}

// ────────────────────────────────────────────────────────────────────────────
// Serialisers
// ────────────────────────────────────────────────────────────────────────────

const API_STATUS = {
  completed: 'COMPLETED',
  unpaid: 'PENDING',
  processing: 'PENDING',
  pending: 'PENDING',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
  expired: 'EXPIRED',
};

/** Merchant API / webhook payload (UddoktaPay-compatible field names). */
function toApiPayload(p) {
  const amount = Number(p.amount);
  const fee = Number(p.fee || 0);
  return {
    full_name: p.full_name,
    email: p.email,
    amount: formatAmount(amount),
    fee: formatAmount(fee),
    charged_amount: formatAmount(amount + fee),
    paid_amount: p.paid_amount == null ? null : formatAmount(p.paid_amount),
    invoice_id: p.invoice_id,
    metadata: parseJson(p.metadata, {}),
    payment_method: p.payment_method,
    sender_number: p.sender_number,
    transaction_id: p.transaction_id,
    date: dhakaDate(p.completed_at || p.submitted_at || p.created_at),
    status: API_STATUS[p.status] || 'PENDING',
    status_detail: p.status,
  };
}

/** Full record for the merchant dashboard. */
function toDashboard(p) {
  return {
    id: p.id,
    invoice_id: p.invoice_id,
    source: p.source,
    full_name: p.full_name,
    email: p.email,
    amount: Number(p.amount),
    fee: Number(p.fee || 0),
    paid_amount: p.paid_amount == null ? null : Number(p.paid_amount),
    currency: p.currency,
    description: p.description,
    metadata: parseJson(p.metadata, null),
    status: p.status,
    payment_method: p.payment_method,
    sender_number: p.sender_number,
    transaction_id: p.transaction_id,
    verified_by: p.verified_by,
    failure_reason: p.failure_reason,
    redirect_url: p.redirect_url,
    cancel_url: p.cancel_url,
    webhook_url: p.webhook_url,
    webhook_status: p.webhook_status,
    webhook_attempts: p.webhook_attempts,
    customer_ip: p.customer_ip,
    created_at: p.created_at,
    submitted_at: p.submitted_at,
    completed_at: p.completed_at,
    expires_at: p.expires_at,
  };
}

/** Everything the public checkout page needs — nothing more. */
async function toCheckout(p) {
  const { merchant, settings } = await loadMerchant(p);
  const methods = await merchants.getActiveMethods(p.user_id);
  const redirectReady = p.status === 'completed' && p.redirect_url;
  return {
    invoice_id: p.invoice_id,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    full_name: p.full_name,
    email: p.email,
    description: p.description,
    created_at: p.created_at,
    expires_at: p.expires_at,
    submitted_at: p.submitted_at,
    completed_at: p.completed_at,
    payment_method: p.payment_method,
    transaction_id: p.transaction_id,
    paid_amount: p.paid_amount == null ? null : Number(p.paid_amount),
    failure_reason: p.status === 'failed' ? p.failure_reason : null,
    merchant: merchants.publicBrand(merchant, settings),
    methods: methods.map((m) => ({
      provider: m.provider,
      name: PROVIDERS[m.provider]?.name || m.provider,
      ussd: PROVIDERS[m.provider]?.ussd || null,
      account_type: m.account_type,
      account_number: m.account_number,
    })),
    cancel_url: p.cancel_url,
    redirect: redirectReady ? { url: p.redirect_url, method: p.return_type, invoice_id: p.invoice_id } : null,
    verify_timeout_seconds: config.payments.verifyTimeoutSeconds,
    server_time: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Verification engine
// ────────────────────────────────────────────────────────────────────────────

async function emitFor(paymentId, event, extra = {}) {
  const payment = await getById(paymentId);
  const { merchant, settings } = await loadMerchant(payment);
  events.emit(event, { payment, merchant, settings, ...extra });
  return payment;
}

/**
 * Try to match a waiting payment against a stored, unused SMS.
 * Row locks make this safe when the customer's submission and the phone's SMS
 * arrive at the same moment.
 */
async function tryMatch(paymentId) {
  const outcome = await db.transaction(async (conn) => {
    const [[p]] = await conn.query('SELECT * FROM payments WHERE id = ? FOR UPDATE', [paymentId]);
    if (!p || !AWAITING_SMS.includes(p.status) || !p.transaction_id) return { matched: false };

    const [[sms]] = await conn.query(
      `SELECT * FROM sms_messages
       WHERE user_id = ? AND provider = ? AND transaction_id = ? AND status = 'unused'
       LIMIT 1 FOR UPDATE`,
      [p.user_id, p.payment_method, p.transaction_id]
    );
    if (!sms) return { matched: false };

    const sufficient = toPaisa(sms.amount) >= toPaisa(p.amount);
    await conn.query("UPDATE sms_messages SET status = 'used', payment_id = ? WHERE id = ?", [p.id, sms.id]);

    if (sufficient) {
      await conn.query(
        `UPDATE payments SET status = 'completed', paid_amount = ?, sms_id = ?,
           sender_number = COALESCE(?, sender_number), verified_by = 'auto',
           failure_reason = NULL, completed_at = UTC_TIMESTAMP()
         WHERE id = ?`,
        [sms.amount, sms.id, sms.from_number, p.id]
      );
    } else {
      await conn.query(
        `UPDATE payments SET status = 'failed', paid_amount = ?, sms_id = ?,
           sender_number = COALESCE(?, sender_number), failure_reason = ?
         WHERE id = ?`,
        [
          sms.amount,
          sms.id,
          sms.from_number,
          `Insufficient amount: received ৳${formatAmount(sms.amount)} of ৳${formatAmount(p.amount)}`,
          p.id,
        ]
      );
    }
    return { matched: true, sufficient };
  });

  if (!outcome.matched) return getById(paymentId);
  return outcome.sufficient
    ? emitFor(paymentId, 'payment.completed', { via: 'auto' })
    : emitFor(paymentId, 'payment.failed', { reason: 'insufficient' });
}

/** Mark expired / escalate a single payment if its time is up. Returns the fresh row. */
async function refresh(payment) {
  if (!payment) return payment;
  if (payment.status === 'unpaid' && new Date(payment.expires_at) < new Date()) {
    await db.query("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'unpaid'", [payment.id]);
    return getById(payment.id);
  }
  if (payment.status === 'processing') {
    const matched = await tryMatch(payment.id);
    if (matched.status !== 'processing') return matched;
    const waited = (Date.now() - new Date(matched.submitted_at).getTime()) / 1000;
    if (waited >= config.payments.verifyTimeoutSeconds) {
      const res = await db.query(
        "UPDATE payments SET status = 'pending' WHERE id = ? AND status = 'processing'",
        [payment.id]
      );
      if (res.affectedRows) return emitFor(payment.id, 'payment.review');
      return getById(payment.id);
    }
    return matched;
  }
  return payment;
}

/** Customer submits the transaction ID from the checkout page. */
async function submitPayment(payment, { provider, transactionId, senderNumber, ip }) {
  payment = await refresh(payment);
  if (payment.status === 'expired') throw new HttpError(410, 'This payment link has expired.');
  if (payment.status !== 'unpaid') throw new HttpError(409, 'This payment has already been submitted.');

  const method = await db.one(
    'SELECT id FROM payment_methods WHERE user_id = ? AND provider = ? AND is_active = 1',
    [payment.user_id, provider]
  );
  if (!method) throw new HttpError(400, 'This payment method is not available for this merchant.');

  const trx = normalizeTrxId(transactionId);
  const reused =
    (await db.one(
      `SELECT id FROM payments
       WHERE user_id = ? AND payment_method = ? AND transaction_id = ? AND id <> ?
         AND status IN ('processing', 'pending', 'completed') LIMIT 1`,
      [payment.user_id, provider, trx, payment.id]
    )) ||
    (await db.one(
      "SELECT id FROM sms_messages WHERE user_id = ? AND provider = ? AND transaction_id = ? AND status = 'used'",
      [payment.user_id, provider, trx]
    ));
  if (reused) throw new HttpError(409, 'This transaction ID has already been used.');

  const res = await db.query(
    `UPDATE payments SET status = 'processing', payment_method = ?, transaction_id = ?,
       sender_number = ?, customer_ip = ?, submitted_at = UTC_TIMESTAMP()
     WHERE id = ? AND status = 'unpaid'`,
    [provider, trx, normalizePhone(senderNumber), ip || null, payment.id]
  );
  if (!res.affectedRows) throw new HttpError(409, 'This payment has already been submitted.');

  return tryMatch(payment.id);
}

/** A new SMS was stored — complete any payment that was waiting for it. */
async function matchSms(sms) {
  if (sms.status !== 'unused' || !sms.transaction_id) return null;
  const waiting = await db.one(
    `SELECT id FROM payments
     WHERE user_id = ? AND payment_method = ? AND transaction_id = ? AND status IN ('processing', 'pending')
     ORDER BY submitted_at ASC LIMIT 1`,
    [sms.user_id, sms.provider, sms.transaction_id]
  );
  return waiting ? tryMatch(waiting.id) : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Manual actions (dashboard / Telegram)
// ────────────────────────────────────────────────────────────────────────────

const APPROVABLE = ['unpaid', 'processing', 'pending', 'failed', 'expired'];
const REJECTABLE = ['unpaid', 'processing', 'pending', 'failed'];

async function approvePayment(payment, { by }) {
  if (!APPROVABLE.includes(payment.status)) {
    throw new HttpError(409, `A ${payment.status} payment cannot be approved.`);
  }
  await db.transaction(async (conn) => {
    let paidAmount = payment.paid_amount;
    let smsId = payment.sms_id;
    if (!smsId && payment.transaction_id && payment.payment_method) {
      const [[sms]] = await conn.query(
        `SELECT id, amount FROM sms_messages
         WHERE user_id = ? AND provider = ? AND transaction_id = ? AND status = 'unused' FOR UPDATE`,
        [payment.user_id, payment.payment_method, payment.transaction_id]
      );
      if (sms) {
        await conn.query("UPDATE sms_messages SET status = 'used', payment_id = ? WHERE id = ?", [payment.id, sms.id]);
        smsId = sms.id;
        paidAmount = sms.amount;
      }
    }
    await conn.query(
      `UPDATE payments SET status = 'completed', verified_by = ?, failure_reason = NULL,
         paid_amount = COALESCE(?, paid_amount, amount), sms_id = ?, completed_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [by, paidAmount, smsId, payment.id]
    );
  });
  return emitFor(payment.id, 'payment.completed', { via: by });
}

async function rejectPayment(payment, { by, reason }) {
  if (!REJECTABLE.includes(payment.status)) {
    throw new HttpError(409, `A ${payment.status} payment cannot be rejected.`);
  }
  const why = reason ? `Rejected by merchant: ${reason}` : 'Rejected by merchant';
  await db.query("UPDATE payments SET status = 'failed', failure_reason = ? WHERE id = ?", [why.slice(0, 255), payment.id]);
  return emitFor(payment.id, 'payment.failed', { reason: 'rejected', via: by });
}

async function cancelPayment(payment) {
  if (payment.status !== 'unpaid') throw new HttpError(409, 'Only unpaid payments can be cancelled.');
  await db.query("UPDATE payments SET status = 'cancelled' WHERE id = ? AND status = 'unpaid'", [payment.id]);
  return getById(payment.id);
}

// ────────────────────────────────────────────────────────────────────────────
// Background sweeper
// ────────────────────────────────────────────────────────────────────────────

async function sweep() {
  await db.query("UPDATE payments SET status = 'expired' WHERE status = 'unpaid' AND expires_at < UTC_TIMESTAMP()");
  const stale = await db.query(
    `SELECT * FROM payments WHERE status = 'processing'
       AND submitted_at < UTC_TIMESTAMP() - INTERVAL ? SECOND LIMIT 100`,
    [config.payments.verifyTimeoutSeconds]
  );
  for (const p of stale) await refresh(p);
}

let sweeper = null;
function startSweeper(intervalMs = 10_000) {
  if (sweeper) return;
  sweeper = setInterval(() => {
    sweep().catch((err) => console.error('[payments] sweep failed:', err.message));
  }, intervalMs);
  sweeper.unref();
}

module.exports = {
  FINAL_STATUSES,
  checkoutUrl,
  dhakaDate,
  getById,
  getByInvoice,
  createPayment,
  toApiPayload,
  toDashboard,
  toCheckout,
  refresh,
  submitPayment,
  matchSms,
  tryMatch,
  approvePayment,
  rejectPayment,
  cancelPayment,
  sweep,
  startSweeper,
};
