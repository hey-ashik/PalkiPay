'use strict';

/**
 * Supported mobile financial services (MFS).
 * `senders` are the SMS sender IDs each provider uses on Bangladeshi networks.
 */
const PROVIDERS = {
  bkash: { id: 'bkash', name: 'bKash', senders: ['bkash'], ussd: '*247#' },
  nagad: { id: 'nagad', name: 'Nagad', senders: ['nagad'], ussd: '*167#' },
  rocket: { id: 'rocket', name: 'Rocket', senders: ['16216', 'rocket', 'dbbl'], ussd: '*322#' },
  upay: { id: 'upay', name: 'Upay', senders: ['upay'], ussd: '*268#' },
};

const PROVIDER_IDS = Object.keys(PROVIDERS);

const isProvider = (id) => Object.prototype.hasOwnProperty.call(PROVIDERS, id);

module.exports = { PROVIDERS, PROVIDER_IDS, isProvider };
