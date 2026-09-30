#!/usr/bin/env node
'use strict';

/**
 * Fingerprint of everything that determines the Next.js build output
 * (frontend sources + the lockfile). GitHub Actions stamps it into the prebuilt
 * build; a server that cannot compile uses it to fetch the build that matches
 * its own code exactly.
 *
 *   node scripts/source-hash.js   → prints the hash
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set(['node_modules', '.next', '.next-prebuilt']);
// Generated or tooling files that do not affect the build output.
const SKIP_FILES = new Set(['next-env.d.ts', 'AGENTS.md', 'CLAUDE.md']);

function walk(dir, root, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, root, out);
    } else if (entry.isFile() && !SKIP_FILES.has(entry.name) && !entry.name.endsWith('.tsbuildinfo')) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
}

/**
 * Installed dependency versions from the lockfile. Only name@version counts: hosts
 * that run `npm install` (not `npm ci`) may rewrite lockfile metadata — e.g. npm 10
 * drops the "libc" fields npm 11 writes — without changing any version.
 */
function dependencySignature(root) {
  const file = path.join(root, 'package-lock.json');
  if (!fs.existsSync(file)) return '';
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.entries(lock.packages || {})
    .filter(([key]) => key !== '')
    .map(([key, meta]) => `${key}@${meta.version || meta.resolved || ''}`)
    .sort()
    .join('\n');
}

/** "<frontend sources>-<dependencies>" — two parts so a mismatch shows which side differs. */
function frontendSourceHash(root = path.resolve(__dirname, '..')) {
  const files = [];
  walk(path.join(root, 'frontend'), root, files);
  files.sort();
  const sources = crypto.createHash('sha256');
  for (const file of files) {
    // Normalise line endings so Windows and Linux checkouts agree.
    const content = fs.readFileSync(path.join(root, file)).toString('latin1').replace(/\r\n/g, '\n');
    sources.update(`${file}\0${content}\0`);
  }
  const deps = crypto.createHash('sha256').update(dependencySignature(root));
  return `${sources.digest('hex').slice(0, 10)}-${deps.digest('hex').slice(0, 8)}`;
}

module.exports = { frontendSourceHash };

if (require.main === module) console.log(frontendSourceHash());
