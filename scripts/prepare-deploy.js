#!/usr/bin/env node
'use strict';

/**
 * Assemble a ready-to-run copy of PalkiPay (source + prebuilt Next.js output)
 * for hosts that cannot build Next.js themselves — Hostinger's shared servers
 * have a glibc too old for Next's native compiler.
 *
 *   npm run build && node scripts/prepare-deploy.js [outDir]    (default: deploy-out)
 *
 * GitHub Actions runs this on every push to main and publishes the result to the
 * `deploy` branch, which is the branch Hostinger deploys.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(ROOT, process.argv[2] || 'deploy-out');
const NEXT_DIR = path.join(ROOT, 'frontend', '.next');

// Tracked files that the running app does not need.
const EXCLUDE = [/^Resources\//, /^\.github\//, /^\.claude\//];
// Build-time only parts of .next.
const NEXT_SKIP = new Set(['cache', 'dev', 'trace', 'types', 'diagnostics']);

if (!fs.existsSync(path.join(NEXT_DIR, 'BUILD_ID'))) {
  console.error('[deploy] frontend/.next is missing — run `npm run build` first.');
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1. Source files: tracked by git, plus new files that are not git-ignored.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !EXCLUDE.some((re) => re.test(f)));
for (const file of files) {
  const src = path.join(ROOT, file);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, file));
}

// 2. Prebuilt Next.js output.
for (const entry of fs.readdirSync(NEXT_DIR)) {
  if (NEXT_SKIP.has(entry)) continue;
  fs.cpSync(path.join(NEXT_DIR, entry), path.join(OUT, 'frontend', '.next', entry), { recursive: true });
}

// 3. On the host, `npm run build` must not try to compile again.
const pkgFile = path.join(OUT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.scripts.build = 'node scripts/check-build.js';
fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

// 4. The deploy tree carries its build output, so .next must NOT be ignored here.
fs.writeFileSync(path.join(OUT, '.gitignore'), 'node_modules/\nlogs/\n.env\n.env.*\n!.env.example\n.local-db/\n');

// 5. Build info, shown on /api/health as "version".
let commit = process.env.GITHUB_SHA || '';
try {
  commit = commit || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  // not a git checkout
}
fs.writeFileSync(
  path.join(OUT, 'DEPLOY_INFO.json'),
  `${JSON.stringify({ commit: commit.slice(0, 7), built_at: new Date().toISOString(), node: process.version }, null, 2)}\n`
);

const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? size(p) : fs.statSync(p).size);
  }, 0);
console.log(`[deploy] ${files.length} source files + prebuilt frontend → ${path.relative(ROOT, OUT) || OUT} (${(size(OUT) / 1e6).toFixed(1)} MB)`);
