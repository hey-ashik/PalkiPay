'use strict';

/**
 * Standalone API server (without the Next.js frontend).
 * Normally you run the unified server from the repo root (`npm run dev` / `npm start`);
 * this entry is useful for API-only development and testing.
 */
const { createApp, startBackground } = require('./app');

const port = Number(process.env.API_PORT) || 5000;
const app = createApp();
app.use((_req, res) => res.status(404).json({ status: false, message: 'Not found.' }));

app.listen(port, () => {
  console.log(`[api] PalkiPay API listening on http://localhost:${port}`);
  startBackground();
});
