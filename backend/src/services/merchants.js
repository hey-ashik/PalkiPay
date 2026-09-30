'use strict';

const db = require('../db/pool');

const USER_COLUMNS = 'id, name, email, phone, slug, role, status, api_key, last_login_at, created_at';

async function findById(id) {
  return db.one(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
}

async function findBySlug(slug) {
  return db.one(`SELECT ${USER_COLUMNS} FROM users WHERE slug = ?`, [String(slug || '').toLowerCase()]);
}

async function findByApiKey(apiKey) {
  if (!apiKey) return null;
  return db.one(`SELECT ${USER_COLUMNS} FROM users WHERE api_key = ?`, [apiKey]);
}

async function getSettings(userId) {
  const row = await db.one('SELECT * FROM merchant_settings WHERE user_id = ?', [userId]);
  if (row) return row;
  await db.query('INSERT IGNORE INTO merchant_settings (user_id) VALUES (?)', [userId]);
  return db.one('SELECT * FROM merchant_settings WHERE user_id = ?', [userId]);
}

async function getActiveMethods(userId) {
  return db.query(
    `SELECT provider, account_type, account_number FROM payment_methods
     WHERE user_id = ? AND is_active = 1 ORDER BY FIELD(provider, 'bkash', 'nagad', 'rocket', 'upay')`,
    [userId]
  );
}

/** Public branding shown on checkout and the merchant's public page. */
function publicBrand(user, settings) {
  return {
    slug: user.slug,
    brand_name: settings?.brand_name || user.name,
    logo: settings?.brand_logo || null,
    support_phone: settings?.support_phone || null,
    support_email: settings?.support_email || null,
  };
}

module.exports = { findById, findBySlug, findByApiKey, getSettings, getActiveMethods, publicBrand };
