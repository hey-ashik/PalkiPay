'use strict';

const mysql = require('mysql2/promise');
const config = require('../config');
const migrations = require('./migrations');

/**
 * Local convenience: if the configured database does not exist yet
 * (e.g. a fresh XAMPP install), try to create it. On Hostinger the
 * database already exists and the user cannot create databases, which is fine.
 */
async function ensureDatabase() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
  });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.name.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await conn.end();
  }
}

async function runMigrations({ log = console.log } = {}) {
  const db = require('./pool');
  try {
    const via = await db.connect();
    log(`[db] connected via ${via}`);
  } catch (err) {
    if (err.code !== 'ER_BAD_DB_ERROR') throw err;
    log(`[db] database "${config.db.name}" not found — creating it`);
    await ensureDatabase();
  }
  const conn = await db.pool.getConnection();

  try {
    // Serialise migrations across processes.
    const [[lock]] = await conn.query("SELECT GET_LOCK('palkipay_migrations', 30) AS ok");
    if (!lock.ok) throw new Error('Could not acquire migration lock');

    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const [rows] = await conn.query('SELECT id FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.id));
    let count = 0;

    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      log(`[db] applying migration ${migration.id}`);
      for (const statement of migration.up) {
        await conn.query(statement);
      }
      await conn.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
      count += 1;
    }

    log(count ? `[db] ${count} migration(s) applied` : '[db] schema up to date');
  } finally {
    await conn.query("SELECT RELEASE_LOCK('palkipay_migrations')").catch(() => {});
    conn.release();
  }
}

module.exports = { runMigrations };

// `npm run migrate`
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db] migration failed:', err.message);
      process.exit(1);
    });
}
