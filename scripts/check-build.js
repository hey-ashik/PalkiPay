#!/usr/bin/env node
'use strict';

/**
 * `npm run build` on the deploy branch. The frontend there is already built by
 * GitHub Actions, so this only confirms the build is present. Without it, fall
 * back to a normal build.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildId = path.join(__dirname, '..', 'frontend', '.next', 'BUILD_ID');
if (fs.existsSync(buildId)) {
  console.log(`[build] prebuilt frontend found (build ${fs.readFileSync(buildId, 'utf8').trim()}) — nothing to compile.`);
} else {
  execSync('npm run build --workspace frontend', { stdio: 'inherit' });
}
