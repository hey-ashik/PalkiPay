'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSms } = require('../src/services/smsParser');

test('bKash send-money received', () => {
  const r = parseSms({
    sender: 'bKash',
    body: 'You have received Tk 1,500.00 from 01712345678. Fee Tk 0.00. Balance Tk 12,345.67. TrxID BK12AB34CD at 29/09/2026 16:30',
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'bkash');
  assert.equal(r.amount, 1500);
  assert.equal(r.fromNumber, '01712345678');
  assert.equal(r.transactionId, 'BK12AB34CD');
  assert.equal(r.balance, 12345.67);
});

test('bKash cash-in without sender name is detected from the body', () => {
  const r = parseSms({
    sender: '',
    body: 'Cash In Tk 500.00 from 01812345678 successful. Fee Tk 0.00. Balance Tk 1,000.00. TrxID CFG7H8J9K0 at 29/09/2026 10:02',
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'bkash');
  assert.equal(r.amount, 500);
  assert.equal(r.transactionId, 'CFG7H8J9K0');
});

test('Nagad money received (multi-line)', () => {
  const r = parseSms({
    sender: 'NAGAD',
    body: 'Money Received.\nAmount: Tk 750.50\nSender: 01912345678\nRef: N/A\nTxnID: 71ABCD12\nBalance: Tk 1,000.00\n29/09/2026 16:30',
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'nagad');
  assert.equal(r.amount, 750.5);
  assert.equal(r.fromNumber, '01912345678');
  assert.equal(r.transactionId, '71ABCD12');
});

test('Rocket received', () => {
  const r = parseSms({
    sender: '16216',
    body: 'Tk500.00 received from A/C:01612345678 Fee:Tk0, Your A/C Balance: Tk1,500.00 TxnId:1234567890 Date:29-SEP-26 04:30:12 pm.',
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'rocket');
  assert.equal(r.amount, 500);
  assert.equal(r.fromNumber, '01612345678');
  assert.equal(r.transactionId, '1234567890');
});

test('Upay received', () => {
  const r = parseSms({
    sender: 'upay',
    body: 'You have received Tk. 320.00 from +8801512345678. TrxID: 01ABCD2345. Balance Tk. 1,000.00',
  });
  assert.equal(r.ok, true);
  assert.equal(r.provider, 'upay');
  assert.equal(r.amount, 320);
  assert.equal(r.fromNumber, '01512345678');
  assert.equal(r.transactionId, '01ABCD2345');
});

test('outgoing payment is rejected', () => {
  const r = parseSms({
    sender: 'bKash',
    body: 'Send Money Tk 200.00 to 01712345678 successful. Fee Tk 0.00. Balance Tk 800.00. TrxID BK99ZZ88YY at 29/09/2026 11:00',
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /incoming/);
});

test('unrelated sender is rejected', () => {
  const r = parseSms({ sender: 'GP', body: 'Your internet pack has been activated.' });
  assert.equal(r.ok, false);
});

test('lowercase transaction id is normalised to uppercase', () => {
  const r = parseSms({
    sender: 'bKash',
    body: 'You have received Tk 100.00 from 01712345678. Fee Tk 0.00. Balance Tk 100.00. TrxID bk12ab34cd at 29/09/2026 16:30',
  });
  assert.equal(r.transactionId, 'BK12AB34CD');
});
