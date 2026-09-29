'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: true,
  enableKeepAlive: true,
  // All DATETIME values are stored and read as UTC.
  timezone: 'Z',
  decimalNumbers: true,
  charset: 'utf8mb4',
});

pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

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

module.exports = { pool, query, one, transaction };
