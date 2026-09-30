'use strict';

const { PROVIDERS } = require('./providers');
const { normalizePhone, normalizeTrxId } = require('../utils');

/**
 * Parses incoming-money SMS from bKash, Nagad, Rocket and Upay.
 *
 * Typical formats:
 *  bKash  "You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 12,345.67. TrxID BK12AB34CD at 29/09/2026 16:30"
 *  bKash  "Cash In Tk 500.00 from 01712345678 successful. Fee Tk 0.00. Balance Tk 1,000.00. TrxID BK12AB34CD at 29/09/2026 16:30"
 *  Nagad  "Money Received.\nAmount: Tk 500.00\nSender: 01712345678\nRef: N/A\nTxnID: 71ABCD12\nBalance: Tk 1,000.00\n29/09/2026 16:30"
 *  Rocket "Tk500.00 received from A/C:01712345678 Fee:Tk0, Your A/C Balance: Tk1,500.00 TxnId:1234567890 Date:29-SEP-26 04:30:12 pm."
 *  Upay   "You have received Tk. 500.00 from 01712345678. TrxID: 01ABCD2345. Balance Tk. 1,000.00"
 */

const MONEY = '([\\d,]+(?:\\.\\d{1,2})?)';
const CURRENCY = '(?:Tk\\.?|BDT|৳)';

const RE = {
  incoming: /\breceived\b|\bcash\s*in\b|\bmoney\s+received\b/i,
  amountLabelled: new RegExp(`Amount\\s*:?\\s*${CURRENCY}\\s*${MONEY}`, 'i'),
  amountAny: new RegExp(`${CURRENCY}\\s*${MONEY}`, 'i'),
  trx: /\b(?:TrxID|TxnID|Trx\.?\s*ID|Txn\.?\s*ID|Transaction\s*ID)\s*[:.#-]?\s*([A-Z0-9]{6,30})\b/i,
  from: /\b(?:from|Sender)\s*(?:A\/C)?\s*:?\s*(\+?(?:88)?01[3-9]\d{8})/i,
  balance: new RegExp(`Balance\\s*:?\\s*${CURRENCY}\\s*${MONEY}`, 'i'),
};

const toNumber = (s) => (s == null ? null : Number(String(s).replace(/,/g, '')));

/** Work out which provider an SMS belongs to from the sender ID, then the body. */
function detectProvider(sender, body) {
  const s = String(sender || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s) {
    for (const p of Object.values(PROVIDERS)) {
      if (p.senders.some((id) => s.includes(id))) return p.id;
    }
  }
  const b = String(body || '');
  if (/bkash/i.test(b)) return 'bkash';
  if (/nagad/i.test(b)) return 'nagad';
  if (/upay/i.test(b)) return 'upay';
  if (/rocket|dbbl|A\/C:.*TxnId/i.test(b)) return 'rocket';
  // bKash messages rarely name themselves; "TrxID ... at dd/mm/yyyy" is its signature.
  if (/TrxID\s+[A-Z0-9]{8,12}\s+at\s+\d{1,2}\/\d{1,2}\/\d{4}/i.test(b)) return 'bkash';
  if (/Money Received\.[\s\S]*TxnID/i.test(b)) return 'nagad';
  return null;
}

/**
 * @param {{ sender?: string, body: string, providerHint?: string }} input
 * @returns {{ ok: boolean, reason?: string, provider: string|null, transactionId: string|null,
 *             amount: number|null, fromNumber: string|null, balance: number|null }}
 */
function parseSms({ sender, body, providerHint }) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  const provider = detectProvider(sender, text) || providerHint || null;

  const trxMatch = text.match(RE.trx);
  const amountMatch = text.match(RE.amountLabelled) || text.match(RE.amountAny);
  const fromMatch = text.match(RE.from);
  const balanceMatch = text.match(RE.balance);

  const result = {
    ok: false,
    provider,
    transactionId: trxMatch ? normalizeTrxId(trxMatch[1]) : null,
    amount: amountMatch ? toNumber(amountMatch[1]) : null,
    fromNumber: fromMatch ? normalizePhone(fromMatch[1]) : null,
    balance: balanceMatch ? toNumber(balanceMatch[1]) : null,
  };

  if (!text) return { ...result, reason: 'Empty message' };
  if (!provider) return { ...result, reason: 'Unknown sender — not a supported payment provider' };
  if (!RE.incoming.test(text)) return { ...result, reason: 'Not an incoming-money message' };
  if (!result.transactionId) return { ...result, reason: 'Transaction ID not found in message' };
  if (!result.amount || result.amount <= 0) return { ...result, reason: 'Amount not found in message' };

  return { ...result, ok: true };
}

module.exports = { parseSms, detectProvider };
