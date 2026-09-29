#!/usr/bin/env node
'use strict';

/**
 * Auto-push: commit every change in the repo and push it to GitHub, which
 * triggers the Hostinger redeploy.
 *
 *   npm run push              one-shot: commit + push now (if anything changed)
 *   npm run autopush          watch mode: push automatically ~15s after files change
 *   node scripts/auto-push.js --quiet   one-shot, prints only on errors / pushes
 *
 * Safety: the repository is public, so before every commit the staged diff is
 * scanned for the secret values in your local .env (DB password, JWT secret, …).
 * If any appear, nothing is committed.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const QUIET = args.has('--quiet');
const WATCH = args.has('--watch');
const DEBOUNCE_MS = 15_000;
const IGNORE = [/(^|[\\/])\.git([\\/]|$)/, /node_modules/, /[\\/]\.next([\\/]|$)/, /\.log$/, /(^|[\\/])\.env$/];

const log = (...m) => !QUIET && console.log('[auto-push]', ...m);
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Secret values from .env that must never reach the public repo. */
function secretValues() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]*(PASSWORD|SECRET|TOKEN|KEY)[A-Z0-9_]*)\s*=\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((m) => m[3].replace(/^["']|["']$/g, ''))
    .filter((v) => v.length >= 6 && !/^change-me/.test(v));
}

function summarize(files) {
  const areas = new Set(
    files.map((f) => {
      if (f.startsWith('frontend/')) return 'frontend';
      if (f.startsWith('backend/')) return 'backend';
      if (f.startsWith('docs/') || f.endsWith('.md')) return 'docs';
      return 'project';
    })
  );
  const list = files.slice(0, 5).map((f) => path.basename(f)).join(', ');
  return `chore(auto): update ${[...areas].join(' + ')} — ${files.length} file${files.length === 1 ? '' : 's'} (${list}${files.length > 5 ? ', …' : ''})`;
}

function pushOnce() {
  try {
    git('rev-parse', '--is-inside-work-tree');
  } catch {
    console.error('[auto-push] not a git repository');
    return false;
  }

  git('add', '-A');
  const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  if (!staged.length) {
    log('nothing to commit');
    return pushPending();
  }

  // Never commit .env files or known secrets.
  const envFiles = staged.filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'));
  const diff = git('diff', '--cached', '-U0');
  const leaked = secretValues().filter((v) => diff.includes(v));
  if (envFiles.length || leaked.length) {
    git('reset', '-q');
    console.error(
      `[auto-push] BLOCKED — ${envFiles.length ? `.env file staged (${envFiles.join(', ')})` : 'a secret value from .env appears in your changes'}. Nothing was committed.`
    );
    return false;
  }

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  git('commit', '-q', '-m', summarize(staged));
  console.log(`[auto-push] committed ${staged.length} file(s) on ${branch}`);
  return pushPending();
}

function pushPending() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  try {
    git('fetch', '-q', 'origin', branch);
    const ahead = Number(git('rev-list', '--count', `origin/${branch}..HEAD`));
    const behind = Number(git('rev-list', '--count', `HEAD..origin/${branch}`));
    if (behind) git('pull', '-q', '--rebase', 'origin', branch);
    if (!ahead) return true;
    git('push', '-q', 'origin', branch);
    console.log(`[auto-push] pushed ${ahead} commit(s) to origin/${branch}`);
    return true;
  } catch (err) {
    console.error('[auto-push] push failed:', (err.stderr || err.message || '').toString().trim());
    return false;
  }
}

if (!WATCH) {
  process.exitCode = pushOnce() ? 0 : 1;
} else {
  let timer = null;
  const schedule = (file) => {
    if (!file || IGNORE.some((re) => re.test(file))) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      log(`changes detected — pushing`);
      pushOnce();
    }, DEBOUNCE_MS);
  };
  fs.watch(ROOT, { recursive: true }, (_event, file) => schedule(file && String(file)));
  console.log(`[auto-push] watching ${ROOT} — changes are pushed ${DEBOUNCE_MS / 1000}s after the last edit. Ctrl+C to stop.`);
  pushOnce();
}
