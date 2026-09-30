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

function frontendSourceHash(root = path.resolve(__dirname, '..')) {
  const files = [];
  walk(path.join(root, 'frontend'), root, files);
  if (fs.existsSync(path.join(root, 'package-lock.json'))) files.push('package-lock.json');
  files.sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    // Normalise line endings so Windows and Linux checkouts agree.
    const content = fs.readFileSync(path.join(root, file)).toString('latin1').replace(/\r\n/g, '\n');
    hash.update(`${file}\0${content}\0`);
  }
  return hash.digest('hex').slice(0, 16);
}

module.exports = { frontendSourceHash };

if (require.main === module) console.log(frontendSourceHash());
