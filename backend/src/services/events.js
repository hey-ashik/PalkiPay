'use strict';

const { EventEmitter } = require('events');

/**
 * In-process event bus. The payment engine emits, and side-effect services
 * (Telegram notifications, merchant webhooks) subscribe — so payment logic never
 * waits on, or fails because of, a slow third-party API.
 *
 * Events (payload: { payment, merchant, ...extra }):
 *   payment.completed   payment verified (auto, dashboard or Telegram)
 *   payment.review      needs a human — SMS not found in time
 *   payment.failed      verification failed (e.g. insufficient amount) or rejected
 */
const bus = new EventEmitter();
bus.setMaxListeners(20);

function emit(event, payload) {
  // Defer so emitters never block on listeners, and isolate listener errors.
  setImmediate(() => {
    for (const listener of bus.listeners(event)) {
      Promise.resolve()
        .then(() => listener(payload))
        .catch((err) => console.error(`[events] ${event} listener failed:`, err.message));
    }
  });
}

module.exports = { on: bus.on.bind(bus), emit };
