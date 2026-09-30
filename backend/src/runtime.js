'use strict';

/**
 * Process-wide startup status, shown on /api/health and on the startup page,
 * so a deployment problem is visible in the browser instead of an opaque 503.
 */
const state = {
  startedAt: new Date().toISOString(),
  web: 'starting', // starting | building | ready | error
  webError: null,
  database: 'connecting', // connecting | ready | error
  databaseError: null,
  ports: [],
  warnings: [],
};

function set(patch) {
  Object.assign(state, patch);
}

function warn(message) {
  if (!state.warnings.includes(message)) state.warnings.push(message);
}

module.exports = { state, set, warn };
