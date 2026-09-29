'use strict';

const db = require('../db/pool');

/**
 * Slugs become top-level URLs (palkipay.ashiik.com/<slug>), so anything the
 * app itself routes — or might route in future — is reserved.
 */
const RESERVED = new Set([
  'about', 'account', 'admin', 'administrator', 'api', 'app', 'apps', 'assets', 'auth', 'billing', 'blog',
  'callback', 'checkout', 'config', 'contact', 'dashboard', 'demo', 'dev', 'developer', 'developers', 'docs',
  'download', 'downloads', 'faq', 'favicon.ico', 'features', 'forgot-password', 'help', 'home', 'invoice',
  'invoices', 'legal', 'login', 'logout', 'mail', 'manifest.json', 'me', 'merchant', 'merchants', 'new',
  'onboarding', 'pay', 'payment', 'payments', 'palkipay', 'pricing', 'privacy', 'profile', 'public',
  'register', 'reset-password', 'robots.txt', 'root', 'settings', 'signin', 'signup', 'sitemap.xml',
  'static', 'status', 'support', 'system', 'team', 'terms', 'test', 'uploads', 'user', 'users', 'webhook',
  'webhooks', 'www', '_next',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,31}$/;

const normalize = (value) => String(value || '').trim().toLowerCase();

/** @returns {string|null} a human-readable problem, or null if the format is fine */
function formatProblem(slug) {
  if (slug.length < 3) return 'Use at least 3 characters.';
  if (slug.length > 32) return 'Use 32 characters or fewer.';
  if (!SLUG_RE.test(slug)) return 'Use lowercase letters, numbers and single hyphens (not at the start or end).';
  if (RESERVED.has(slug)) return 'This name is reserved. Try another.';
  return null;
}

async function isTaken(slug) {
  return Boolean(await db.one('SELECT id FROM users WHERE slug = ?', [slug]));
}

async function suggest(base) {
  const root = normalize(base).replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '').slice(0, 24) || 'shop';
  const candidates = [`${root}pay`, `${root}-shop`, `${root}-bd`, `${root}${Math.floor(10 + Math.random() * 89)}`, `${root}-store`];
  const free = [];
  for (const c of candidates) {
    if (!formatProblem(c) && !(await isTaken(c))) free.push(c);
    if (free.length === 3) break;
  }
  return free;
}

/** Full availability check used by the live "is this slug free?" field. */
async function check(value) {
  const slug = normalize(value);
  const problem = formatProblem(slug);
  if (problem) return { slug, available: false, message: problem, suggestions: [] };
  if (await isTaken(slug)) {
    return {
      slug,
      available: false,
      message: 'This URL already exists. Try another one.',
      suggestions: await suggest(slug),
    };
  }
  return { slug, available: true, message: 'This URL is available!', suggestions: [] };
}

module.exports = { normalize, formatProblem, isTaken, check, RESERVED };
