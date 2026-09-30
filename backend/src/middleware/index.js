'use strict';

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db/pool');
const merchants = require('../services/merchants');
const { HttpError } = require('../utils');

// ── Validation ──────────────────────────────────────────────────────────────

/** Validate `req[source]` against a zod schema and replace it with the parsed value. */
const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      if (!fields[key]) fields[key] = issue.message;
    }
    return next(new HttpError(422, Object.values(fields)[0] || 'Invalid request', fields));
  }
  if (source === 'query') req.validQuery = result.data;
  else req[source] = result.data;
  next();
};

// ── Session auth (dashboard) ────────────────────────────────────────────────

function readToken(req) {
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[config.jwt.cookieName] || null;
}

async function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) return next(new HttpError(401, 'Please sign in to continue.'));
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }
  const user = await merchants.findById(payload.sub);
  if (!user) return next(new HttpError(401, 'Account not found.'));
  if (user.status !== 'active') return next(new HttpError(403, 'This account is suspended. Contact support.'));
  req.user = user;
  next();
}

/** Dashboard routes need a claimed slug first. */
function requireSlug(req, _res, next) {
  if (!req.user.slug) return next(new HttpError(409, 'Choose your PalkiPay URL first.'));
  next();
}

// ── Merchant API key (e-commerce integrations) ──────────────────────────────

function readApiKey(req) {
  return (
    req.get('palkipay-api-key') ||
    req.get('rt-uddoktapay-api-key') ||
    req.get('x-api-key') ||
    (req.get('authorization')?.startsWith('Bearer ') ? req.get('authorization').slice(7).trim() : null)
  );
}

/**
 * Authenticates with the merchant API key. When mounted under /:slug/api the
 * key must belong to that slug, so a key can't be used against another store.
 */
async function requireApiKey(req, res, next) {
  const merchant = await merchants.findByApiKey(readApiKey(req));
  const fail = (status, message) => res.status(status).json({ status: false, message });
  if (!merchant) return fail(401, 'Invalid or missing API key.');
  if (merchant.status !== 'active') return fail(403, 'Merchant account is suspended.');
  if (req.params.slug && req.params.slug.toLowerCase() !== merchant.slug) {
    return fail(401, 'API key does not belong to this merchant URL.');
  }
  req.merchant = merchant;
  next();
}

// ── Device key (SMS forwarding apps / iOS Shortcut) ─────────────────────────

function readDeviceKey(req) {
  const header = req.get('authorization');
  return (
    req.get('x-device-key') ||
    (header?.startsWith('Bearer ') ? header.slice(7).trim() : null) ||
    req.body?.device_key ||
    req.query?.key ||
    null
  );
}

async function requireDevice(req, _res, next) {
  const key = readDeviceKey(req);
  if (!key) return next(new HttpError(401, 'Missing device key.'));
  const device = await db.one('SELECT * FROM devices WHERE device_key = ?', [String(key)]);
  if (!device) return next(new HttpError(401, 'Invalid device key.'));
  if (!device.is_active) return next(new HttpError(403, 'This device is disabled in the dashboard.'));
  const merchant = await merchants.findById(device.user_id);
  if (!merchant || merchant.status !== 'active') return next(new HttpError(403, 'Merchant account is not active.'));
  if (req.params.slug && req.params.slug.toLowerCase() !== merchant.slug) {
    return next(new HttpError(401, 'Device does not belong to this merchant URL.'));
  }
  req.device = device;
  req.merchant = merchant;
  db.query('UPDATE devices SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?', [device.id]).catch(() => {});
  next();
}

// ── Rate limits ─────────────────────────────────────────────────────────────

const limiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ status: false, message }),
  });

const limits = {
  auth: limiter(15 * 60 * 1000, 20, 'Too many attempts. Please wait a few minutes and try again.'),
  checkoutSubmit: limiter(10 * 60 * 1000, 15, 'Too many attempts. Please wait a few minutes and try again.'),
  api: limiter(60 * 1000, 120, 'Rate limit exceeded. Slow down.'),
  device: limiter(60 * 1000, 240, 'Rate limit exceeded.'),
};

// ── Errors ──────────────────────────────────────────────────────────────────

function notFound(_req, res) {
  res.status(404).json({ status: false, message: 'Endpoint not found.' });
}

/** MySQL errors that mean "the database is not reachable / not set up", not a bug. */
const DB_UNAVAILABLE = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_NO_SUCH_TABLE',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
]);

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: false, message: 'Request body must be valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ status: false, message: 'Request body is too large.' });
  }
  if (DB_UNAVAILABLE.has(err.code)) {
    console.error(`[api] database unavailable: ${err.code}`);
    return res.status(503).json({
      status: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'PalkiPay can’t reach its database right now, so this action is unavailable. Please try again in a few minutes.',
    });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[api] unhandled error:', err);
  res.status(status).json({
    status: false,
    message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
    ...(err.details ? { errors: err.details } : {}),
  });
}

module.exports = {
  validate,
  requireAuth,
  requireSlug,
  requireApiKey,
  requireDevice,
  limits,
  notFound,
  errorHandler,
};
