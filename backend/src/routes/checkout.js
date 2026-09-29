'use strict';

const express = require('express');
const schemas = require('../validation/schemas');
const payments = require('../services/payments');
const merchants = require('../services/merchants');
const { validate, limits } = require('../middleware');
const { HttpError } = require('../utils');

/** Public endpoints used by the hosted checkout page. */
const router = express.Router();

async function loadPayment(req) {
  const payment = await payments.getByInvoice(req.params.invoiceId);
  if (!payment) throw new HttpError(404, 'Payment not found.');
  // The checkout URL contains the merchant slug; make sure it is the right one.
  if (req.query.slug) {
    const merchant = await merchants.findById(payment.user_id);
    if (!merchant || merchant.slug !== String(req.query.slug).toLowerCase()) {
      throw new HttpError(404, 'Payment not found.');
    }
  }
  return payment;
}

router.get('/:invoiceId', async (req, res) => {
  const payment = await payments.refresh(await loadPayment(req));
  res.json({ status: true, payment: await payments.toCheckout(payment) });
});

/** Lightweight polling endpoint while the customer waits for verification. */
router.get('/:invoiceId/status', async (req, res) => {
  const payment = await payments.refresh(await loadPayment(req));
  res.json({ status: true, payment: await payments.toCheckout(payment) });
});

router.post('/:invoiceId/pay', limits.checkoutSubmit, validate(schemas.submitPayment), async (req, res) => {
  const payment = await loadPayment(req);
  const result = await payments.submitPayment(payment, {
    provider: req.body.provider,
    transactionId: req.body.transaction_id,
    senderNumber: req.body.sender_number,
    ip: req.ip,
  });
  const messages = {
    completed: 'Payment successful!',
    processing: 'Verifying your payment…',
    failed: result.failure_reason || 'Payment verification failed.',
  };
  res.json({
    status: result.status !== 'failed',
    message: messages[result.status] || 'Payment submitted.',
    payment: await payments.toCheckout(result),
  });
});

router.post('/:invoiceId/cancel', async (req, res) => {
  const payment = await payments.cancelPayment(await loadPayment(req));
  res.json({ status: true, message: 'Payment cancelled.', payment: await payments.toCheckout(payment) });
});

module.exports = router;
