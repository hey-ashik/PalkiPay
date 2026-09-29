'use strict';

const crypto = require('crypto');

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Cryptographically random alphanumeric string. */
function randomString(length = 20) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHANUM[bytes[i] % ALPHANUM.length];
  return out;
}

const newInvoiceId = () => randomString(20);
const newApiKey = () => randomString(40);
const newDeviceKey = () => `dev_${randomString(36)}`;
const newSecret = () => crypto.randomBytes(24).toString('hex');

/** Error with an HTTP status that the error middleware turns into JSON. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Money helpers — compare in paisa to avoid float drift. */
const toPaisa = (value) => Math.round(Number(value) * 100);
const formatAmount = (value) => (Math.round(Number(value) * 100) / 100).toFixed(2);

/** Normalise a Bangladeshi mobile number to 01XXXXXXXXX (or null). */
function normalizePhone(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  const match = digits.match(/(?:88)?(01[3-9]\d{8})$/);
  return match ? match[1] : null;
}

/** Normalise a transaction ID for matching. */
const normalizeTrxId = (value) => String(value || '').replace(/\s+/g, '').toUpperCase();

/** MySQL DATETIME (UTC) from a Date. */
const toSqlDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  randomString,
  newInvoiceId,
  newApiKey,
  newDeviceKey,
  newSecret,
  HttpError,
  toPaisa,
  formatAmount,
  normalizePhone,
  normalizeTrxId,
  toSqlDate,
  parseJson,
};
