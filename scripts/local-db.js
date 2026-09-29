#!/usr/bin/env node
'use strict';

/**
 * Portable local MySQL (MariaDB) for development on Windows — no XAMPP needed.
 *
 *   npm run db:start   download (first time only), start MariaDB, create the DB + user from .env
 *   npm run db:stop    stop it
 *
 * Everything lives in ./.local-db (git-ignored). On macOS/Linux, install MySQL or
 * MariaDB with your package manager instead and run `npm run migrate`.
 */

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.local-db');
const VERSION = '11.4.5';
const PKG = `mariadb-${VERSION}-winx64`;
const URL_ZIP = `https://archive.mariadb.org/mariadb-${VERSION}/winx64-packages/${PKG}.zip`;
const BIN = path.join(DIR, PKG, 'bin');
const DATA = path.join(DIR, 'data');

require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
const env = {
  port: Number(process.env.DB_PORT) || 3306,
  name: process.env.DB_NAME || 'palkipay',
  user: process.env.DB_USER || 'palkipay',
  password: process.env.DB_PASSWORD || '',
};

const exe = (name) => path.join(BIN, `${name}.exe`);
const sql = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });
}

async function waitForPort(port, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function ensureBinaries() {
  if (fs.existsSync(exe('mariadbd'))) return;
  fs.mkdirSync(DIR, { recursive: true });
  const zip = path.join(DIR, `${PKG}.zip`);
  console.log(`[db] downloading MariaDB ${VERSION} (~90 MB, first time only)…`);
  const res = await fetch(URL_ZIP);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  console.log('[db] extracting…');
  execFileSync('tar', ['-xf', zip, '-C', DIR], { stdio: 'inherit' });
  fs.unlinkSync(zip);
}

async function start() {
  if (process.platform !== 'win32') {
    console.log('[db] The portable database is for Windows. On macOS/Linux install MySQL/MariaDB and run `npm run migrate`.');
    return;
  }
  if (await portOpen(env.port)) {
    console.log(`[db] something is already listening on port ${env.port} — assuming MySQL is running.`);
    return;
  }
  await ensureBinaries();

  const ini = path.join(DATA, 'my.ini');
  if (!fs.existsSync(ini)) {
    console.log('[db] initialising data directory…');
    execFileSync(exe('mariadb-install-db'), [`--datadir=${DATA}`, `--port=${env.port}`], { stdio: 'ignore' });
  }
  // my.ini stores absolute paths — keep them correct even if the project folder moved.
  const fwd = (p) => p.replace(/\\/g, '/');
  fs.writeFileSync(
    ini,
    fs
      .readFileSync(ini, 'utf8')
      .replace(/^datadir=.*$/m, `datadir=${fwd(DATA)}`)
      .replace(/^plugin-dir=.*$/m, `plugin-dir=${fwd(path.join(DIR, PKG, 'lib', 'plugin'))}`)
  );

  const log = fs.openSync(path.join(DIR, 'mariadb.log'), 'a');
  const child = spawn(exe('mariadbd'), [`--defaults-file=${path.join(DATA, 'my.ini')}`, '--console'], {
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
  });
  child.unref();

  if (!(await waitForPort(env.port))) throw new Error('MariaDB did not start — see .local-db/mariadb.log');

  const statements = [
    `CREATE DATABASE IF NOT EXISTS \`${env.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    ...['%', 'localhost'].flatMap((host) => [
      `CREATE USER IF NOT EXISTS '${sql(env.user)}'@'${host}' IDENTIFIED BY '${sql(env.password)}'`,
      `ALTER USER '${sql(env.user)}'@'${host}' IDENTIFIED BY '${sql(env.password)}'`,
      `GRANT ALL PRIVILEGES ON \`${env.name}\`.* TO '${sql(env.user)}'@'${host}'`,
    ]),
    'FLUSH PRIVILEGES',
  ];
  execFileSync(exe('mariadb'), ['-uroot', '-h127.0.0.1', `-P${env.port}`, '-e', statements.join('; ')], { stdio: 'inherit' });
  console.log(`[db] MariaDB running on 127.0.0.1:${env.port} — database "${env.name}", user "${env.user}" ready.`);
  console.log('[db] Tables are created automatically when you run `npm run dev`.');
}

function stop() {
  if (!fs.existsSync(exe('mariadb-admin'))) return console.log('[db] local database is not installed.');
  try {
    execFileSync(exe('mariadb-admin'), ['-uroot', '-h127.0.0.1', `-P${env.port}`, 'shutdown'], { stdio: 'ignore' });
    console.log('[db] stopped.');
  } catch {
    console.log('[db] not running.');
  }
}

const cmd = process.argv[2];
if (cmd === 'stop') stop();
else
  start().catch((err) => {
    console.error('[db]', err.message);
    process.exit(1);
  });
