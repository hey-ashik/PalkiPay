'use strict';

/**
 * PalkiPay unified server — one Node.js process that serves:
 *   • the Express API        (/api/*, /:slug/api/*)   from ./backend
 *   • the Next.js frontend   (everything else)          from ./frontend
 *
 *   npm run dev   → development (hot reload)
 *   npm start     → production (run `npm run build` first)
 *
 * This is the entry file to use on Hostinger (Node.js app → entry file: server.js).
 */
const path = require('path');

const dev = process.argv.includes('--dev');
process.env.NODE_ENV = dev ? 'development' : 'production';

const config = require('./backend/src/config');
const { createApp, startBackground } = require('./backend/src/app');

const frontendDir = path.join(__dirname, 'frontend');
const next = require(require.resolve('next', { paths: [frontendDir] }));

async function main() {
  const nextApp = next({ dev, dir: frontendDir, port: config.port });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = createApp();
  app.use((req, res) => handle(req, res));

  const server = app.listen(config.port, () => {
    console.log(`\n  PalkiPay ${dev ? '(development)' : '(production)'} ready`);
    console.log(`  → ${config.appUrl}\n`);
    startBackground();
  });

  if (dev && typeof nextApp.getUpgradeHandler === 'function') {
    const upgrade = nextApp.getUpgradeHandler();
    server.on('upgrade', (req, socket, head) => upgrade(req, socket, head));
  }

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
