'use strict';

const db = require('../db/pool');
const payments = require('./payments');
const { parseSms } = require('./smsParser');
const { toSqlDate } = require('../utils');

function parseReceivedAt(value) {
  if (value == null || value === '') return new Date();
  const d = /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(value);
  if (Number.isNaN(d.getTime())) return new Date();
  return d > new Date() ? new Date() : d;
}

/**
 * Store an SMS forwarded by a merchant's phone and try to settle the payment it belongs to.
 * @returns {{ status: 'stored'|'duplicate'|'invalid', reason?: string, sms: object, payment?: object }}
 */
async function ingestSms({ merchantId, deviceId = null, sender, body, receivedAt, providerHint }) {
  const parsed = parseSms({ sender, body, providerHint });
  const status = parsed.ok ? 'unused' : 'invalid';

  let insertId;
  try {
    const res = await db.query(
      `INSERT INTO sms_messages
        (user_id, device_id, sender, body, provider, transaction_id, amount, from_number, balance, status, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        merchantId,
        deviceId,
        sender ? String(sender).slice(0, 60) : null,
        String(body).slice(0, 2000),
        parsed.provider,
        // Only valid messages take part in the (user, provider, trx) uniqueness guarantee.
        parsed.ok ? parsed.transactionId : null,
        parsed.amount,
        parsed.fromNumber,
        parsed.balance,
        status,
        toSqlDate(parseReceivedAt(receivedAt)),
      ]
    );
    insertId = res.insertId;
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    const existing = await db.one(
      'SELECT * FROM sms_messages WHERE user_id = ? AND provider = ? AND transaction_id = ?',
      [merchantId, parsed.provider, parsed.transactionId]
    );
    return { status: 'duplicate', reason: 'This transaction was already received', sms: existing };
  }

  const sms = await db.one('SELECT * FROM sms_messages WHERE id = ?', [insertId]);
  if (!parsed.ok) return { status: 'invalid', reason: parsed.reason, sms };

  const payment = await payments.matchSms(sms);
  return { status: 'stored', sms, payment };
}

function toPublic(sms) {
  return {
    id: sms.id,
    device_id: sms.device_id,
    sender: sms.sender,
    body: sms.body,
    provider: sms.provider,
    transaction_id: sms.transaction_id,
    amount: sms.amount == null ? null : Number(sms.amount),
    from_number: sms.from_number,
    balance: sms.balance == null ? null : Number(sms.balance),
    status: sms.status,
    payment_id: sms.payment_id,
    received_at: sms.received_at,
    created_at: sms.created_at,
  };
}

module.exports = { ingestSms, toPublic };
