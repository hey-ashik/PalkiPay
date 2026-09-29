'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/pool');
const schemas = require('../validation/schemas');
const merchants = require('../services/merchants');
const slugs = require('../services/slugs');
const { validate, requireAuth, limits } = require('../middleware');
const { HttpError, newApiKey } = require('../utils');

const router = express.Router();

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('palkipay-timing-guard', 10);

function issueSession(res, user, remember) {
  const token = jwt.sign({ sub: user.id }, config.jwt.secret, {
    expiresIn: remember ? '30d' : config.jwt.expiresIn,
  });
  res.cookie(config.jwt.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.appUrl.startsWith('https://'),
    path: '/',
    ...(remember ? { maxAge: THIRTY_DAYS } : {}),
  });
  return token;
}

const serializeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  slug: u.slug,
  role: u.role,
  created_at: u.created_at,
});

async function sessionPayload(user) {
  const settings = await merchants.getSettings(user.id);
  const [[counts]] = await db.pool.query(
    `SELECT
       (SELECT COUNT(*) FROM payment_methods WHERE user_id = ? AND is_active = 1) AS methods,
       (SELECT COUNT(*) FROM devices WHERE user_id = ? AND is_active = 1) AS devices,
       (SELECT COUNT(*) FROM payments WHERE user_id = ?) AS payments`,
    [user.id, user.id, user.id]
  );
  return {
    user: serializeUser(user),
    brand: { brand_name: settings.brand_name || user.name, brand_logo: settings.brand_logo },
    setup: {
      slug: Boolean(user.slug),
      payment_methods: counts.methods > 0,
      device: counts.devices > 0,
      telegram: Boolean(settings.telegram_enabled && settings.telegram_chat_id),
      first_payment: counts.payments > 0,
    },
  };
}

router.post('/register', limits.auth, validate(schemas.register), async (req, res) => {
  const { name, email, phone, password, slug } = req.body;

  if (await db.one('SELECT id FROM users WHERE email = ?', [email])) {
    throw new HttpError(409, 'An account with this email already exists.', { email: 'Email already registered' });
  }

  let claimed = null;
  if (slug) {
    const check = await slugs.check(slug);
    if (!check.available) throw new HttpError(409, check.message, { slug: check.message });
    claimed = check.slug;
  }

  const hash = await bcrypt.hash(password, 10);
  let result;
  try {
    result = await db.query(
      'INSERT INTO users (name, email, phone, password_hash, slug, api_key) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone || null, hash, claimed, newApiKey()]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const onSlug = /slug/.test(err.message);
      const message = onSlug ? 'This URL already exists. Try another one.' : 'An account with this email already exists.';
      throw new HttpError(409, message, { [onSlug ? 'slug' : 'email']: message });
    }
    throw err;
  }

  await db.query(
    'INSERT INTO merchant_settings (user_id, brand_name, support_email, support_phone) VALUES (?, ?, ?, ?)',
    [result.insertId, name, email, phone || null]
  );

  const user = await merchants.findById(result.insertId);
  const token = issueSession(res, user, true);
  res.status(201).json({ status: true, token, ...(await sessionPayload(user)) });
});

router.post('/login', limits.auth, validate(schemas.login), async (req, res) => {
  const { email, password, remember } = req.body;
  const row = await db.one('SELECT id, password_hash, status FROM users WHERE email = ?', [email]);
  const ok = await bcrypt.compare(password, row?.password_hash || DUMMY_HASH);
  if (!row || !ok) throw new HttpError(401, 'Incorrect email or password.');
  if (row.status !== 'active') throw new HttpError(403, 'This account is suspended. Contact support.');

  await db.query('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [row.id]);
  const user = await merchants.findById(row.id);
  const token = issueSession(res, user, remember !== false);
  res.json({ status: true, token, ...(await sessionPayload(user)) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(config.jwt.cookieName, { path: '/' });
  res.json({ status: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ status: true, ...(await sessionPayload(req.user)) });
});

/** One account = one slug. It can be claimed once and is permanent after that. */
router.post('/slug', requireAuth, validate(schemas.claimSlug), async (req, res) => {
  if (req.user.slug) throw new HttpError(409, 'Your PalkiPay URL is already set and cannot be changed.');
  const check = await slugs.check(req.body.slug);
  if (!check.available) throw new HttpError(409, check.message, { slug: check.message });
  try {
    await db.query('UPDATE users SET slug = ? WHERE id = ? AND slug IS NULL', [check.slug, req.user.id]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'This URL already exists. Try another one.');
    throw err;
  }
  const user = await merchants.findById(req.user.id);
  res.json({ status: true, ...(await sessionPayload(user)) });
});

router.put('/profile', requireAuth, validate(schemas.profile), async (req, res) => {
  await db.query('UPDATE users SET name = ?, phone = ? WHERE id = ?', [req.body.name, req.body.phone, req.user.id]);
  const user = await merchants.findById(req.user.id);
  res.json({ status: true, message: 'Profile updated.', ...(await sessionPayload(user)) });
});

router.put('/password', requireAuth, limits.auth, validate(schemas.changePassword), async (req, res) => {
  const row = await db.one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(req.body.current_password, row.password_hash))) {
    throw new HttpError(422, 'Current password is incorrect.', { current_password: 'Current password is incorrect' });
  }
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(req.body.new_password, 10), req.user.id]);
  res.json({ status: true, message: 'Password changed.' });
});

module.exports = router;
