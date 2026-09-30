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
 *
 * Built to never fail silently on shared hosting:
 *   - it starts listening immediately (Hostinger's proxy expects port 3000),
 *     before the backend or Next.js load, so there is no opaque 503;
 *   - if the frontend build is missing it builds it in the background;
 *   - any startup problem is shown on the page and on /api/health, and written
 *     to logs/server.log.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const dev = process.argv.includes('--dev');
process.env.NODE_ENV = dev ? 'development' : 'production';

const ROOT = __dirname;
const FRONTEND = path.join(ROOT, 'frontend');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');

// ── Logging (console + logs/server.log) ─────────────────────────────────────
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1024 * 1024) fs.truncateSync(LOG_FILE, 0);
} catch {
  // read-only filesystem — console only
}
function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => (p instanceof Error ? p.stack : String(p))).join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // ignore
  }
}
process.on('unhandledRejection', (err) => log('[process] unhandled rejection:', err));
process.on('uncaughtException', (err) => log('[process] uncaught exception:', err));

// ── Status shared with /api/health ──────────────────────────────────────────
const runtime = require('./backend/src/runtime');
try {
  // Written by scripts/prepare-deploy.js on the deploy branch.
  const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'DEPLOY_INFO.json'), 'utf8'));
  runtime.set({ version: info.commit, builtAt: info.built_at });
} catch {
  runtime.set({ version: 'source' });
}

// ── Backend (loaded defensively so a failure is reported, not fatal) ────────
let config = { port: Number(process.env.PORT) || 3000, appUrl: process.env.APP_URL || '' };
let app = null;
let startBackground = null;
try {
  config = require('./backend/src/config');
  const backend = require('./backend/src/app');
  app = backend.createApp();
  startBackground = backend.startBackground;
} catch (err) {
  log('[server] backend failed to load:', err);
  runtime.set({ web: 'error', webError: `Backend failed to load: ${err.message}` });
}

// ── Startup / error page while Next.js is not ready ─────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function statusPage(res) {
  const s = runtime.state;
  const failed = s.web === 'error';
  const title = failed ? 'PalkiPay could not start' : s.web === 'building' ? 'PalkiPay is being built…' : 'PalkiPay is starting…';
  const detail = failed
    ? `<pre>${esc(s.webError || 'Unknown error')}</pre><p>Details are in <code>logs/server.log</code> and at <a href="/api/health">/api/health</a>.</p>`
    : `<p>${s.web === 'building' ? 'Preparing the website for the first time. This takes a few minutes.' : 'This only takes a few seconds.'} The page refreshes automatically.</p>`;
  const warnings = s.warnings.length ? `<ul>${s.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '';
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${failed ? '' : '<meta http-equiv="refresh" content="8">'}<title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f7fd;color:#0f172a;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:560px;margin:24px;padding:32px;background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 10px 30px -12px rgb(15 23 42/.15)}
.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#009dfa,#006cfa);color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px}
h1{font-size:22px;margin:18px 0 6px}p{color:#475569;margin:8px 0}pre{white-space:pre-wrap;background:#0a1630;color:#e2e8f0;padding:14px;border-radius:12px;font-size:13px}
ul{background:#fffbeb;color:#92400e;border-radius:12px;padding:12px 12px 12px 30px;font-size:13.5px}a{color:#006cfa}code{background:#f1f5f9;padding:1px 5px;border-radius:5px}</style></head>
<body><main><div class="logo">P</div><h1>${esc(title)}</h1>${detail}${warnings}</main></body></html>`);
}

function fallback(req, res) {
  if (req.url.startsWith('/api/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ status: false, service: 'palkipay', ...runtime.state, node: process.version }));
  }
  if (req.url.startsWith('/api/') || /^\/[^/]+\/api\//.test(req.url)) {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '10' });
    return res.end(JSON.stringify({ status: false, message: 'PalkiPay is starting, please retry in a few seconds.' }));
  }
  return statusPage(res);
}

let nextHandle = null;
const handler = app || fallback;
if (app) app.use((req, res) => (nextHandle ? nextHandle(req, res) : statusPage(res)));

// ── Listen right away ───────────────────────────────────────────────────────
// Hostinger's proxy forwards to port 3000; also honour an injected PORT if it differs.
const ports = [...new Set([Number(config.port) || 3000, ...(dev ? [] : [3000])])];
const servers = ports.map((port) => {
  const server = http.createServer(handler);
  server.on('error', (err) => log(`[server] could not listen on port ${port}: ${err.code || err.message}`));
  server.listen(port, () => {
    runtime.state.ports.push(port);
    log(`[server] PalkiPay ${dev ? '(development)' : '(production)'} listening on port ${port}`);
  });
  return server;
});

if (startBackground) startBackground().catch((err) => log('[db] background start failed:', err));

// ── Next.js ─────────────────────────────────────────────────────────────────
function runBuild() {
  return new Promise((resolve, reject) => {
    const nextBin = require.resolve('next/dist/bin/next', { paths: [FRONTEND] });
    log('[web] no production build found — running `next build` (first start only)…');
    const out = fs.openSync(path.join(LOG_DIR, 'build.log'), 'w');
    const child = spawn(process.execPath, [nextBin, 'build'], {
      cwd: FRONTEND,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', out, out],
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      let tail = '';
      try {
        tail = fs.readFileSync(path.join(LOG_DIR, 'build.log'), 'utf8').split('\n').slice(-25).join('\n');
      } catch {
        // ignore
      }
      const hint = /GLIBC|Failed to load SWC/i.test(tail)
        ? 'This server cannot compile Next.js (its system glibc is too old). Deploy the prebuilt `deploy` branch ' +
          'instead of `main` — GitHub Actions builds it on every push (see docs/DEPLOYMENT.md).\n\n'
        : '';
      reject(new Error(`${hint}next build exited with code ${code}\n${tail}`));
    });
  });
}

async function startWeb() {
  if (!app) return;
  const hasBuild = fs.existsSync(path.join(FRONTEND, '.next', 'BUILD_ID'));
  if (!dev && !hasBuild) {
    runtime.set({ web: 'building' });
    await runBuild();
  }
  const next = require(require.resolve('next', { paths: [FRONTEND] }));
  const nextApp = next({ dev, dir: FRONTEND, port: ports[0], httpServer: servers[0] });
  await nextApp.prepare();
  nextHandle = nextApp.getRequestHandler();
  runtime.set({ web: 'ready', webError: null });
  log(`[web] ready → ${config.appUrl || `http://localhost:${ports[0]}`}`);
}

startWeb().catch((err) => {
  log('[web] failed to start:', err);
  runtime.set({ web: 'error', webError: err.message });
});

const shutdown = () => {
  let open = servers.length;
  servers.forEach((s) => s.close(() => --open === 0 && process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
