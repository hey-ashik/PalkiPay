'use strict';

const fs = require('fs');
const mysql = require('mysql2/promise');
const config = require('../config');
const runtime = require('../runtime');

/** MySQL socket files used by common Linux/shared-hosting setups. */
const SOCKETS = ['/var/lib/mysql/mysql.sock', '/var/run/mysqld/mysqld.sock', '/run/mysqld/mysqld.sock', '/tmp/mysql.sock'];

const auth = {
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
};

const poolOptions = {
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  enableKeepAlive: true,
  // All DATETIME values are stored and read as UTC.
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4',
};

function createPool(target) {
  const p = mysql.createPool({ ...auth, ...poolOptions, ...target });
  p.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return p;
}

let pool = createPool({ host: config.db.host, port: config.db.port });

/** Hide the database user name in error messages shown on /api/health. */
const mask = (message) => String(message).replace(/'[^']*'@/g, "'***'@");

/**
 * Find a way to reach MySQL that authenticates, and switch the pool to it.
 * On shared hosting the database user is often granted for `localhost` only, which
 * MySQL treats differently from a TCP connection to 127.0.0.1 — so when the
 * configured host is local we also try `localhost` and the local socket files.
 */
async function connect() {
  const candidates = [{ label: `${config.db.host}:${config.db.port}`, host: config.db.host, port: config.db.port }];
  if (['127.0.0.1', 'localhost', '::1'].includes(config.db.host)) {
    const other = config.db.host === 'localhost' ? '127.0.0.1' : 'localhost';
    candidates.push({ label: `${other}:${config.db.port}`, host: other, port: config.db.port });
    for (const socketPath of SOCKETS) {
      if (fs.existsSync(socketPath)) candidates.push({ label: socketPath, socketPath });
    }
  }

  const failures = [];
  let firstError = null;
  for (const { label, ...target } of candidates) {
    try {
      const conn = await mysql.createConnection({ ...auth, ...target, connectTimeout: 8000 });
      await conn.end();
      if (label !== candidates[0].label) {
        const old = pool;
        pool = createPool(target);
        old.end().catch(() => {});
      }
      runtime.set({ databaseVia: label });
      return label;
    } catch (err) {
      // The database itself is missing (auth worked) — let the caller create it.
      if (err.code === 'ER_BAD_DB_ERROR') {
        if (label !== candidates[0].label) pool = createPool(target);
        throw err;
      }
      firstError = firstError || err;
      failures.push(`${label} → ${err.code || 'ERROR'}: ${mask(err.message)}`);
    }
  }
  const error = new Error(failures.join(' | '));
  error.code = firstError?.code;
  throw error;
}

/** Run a query and return rows. */
async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Run a query and return the first row (or null). */
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** Run `fn(conn)` inside a transaction; commits on success, rolls back on error. */
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  /** The current pool (may be swapped by connect()). */
  get pool() {
    return pool;
  },
  connect,
  mask,
  query,
  one,
  transaction,
};
