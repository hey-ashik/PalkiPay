'use strict';

const express = require('express');
const schemas = require('../validation/schemas');
const payments = require('../services/payments');
const { validate, requireApiKey, limits } = require('../middleware');
const { publicUrl } = require('../utils');

/**
 * Merchant-facing payment API, authenticated by API key.
 * Mounted at /api and /:slug/api, so the merchant's base URL is
 * https://palkipay.ashiik.com/<slug> and endpoints are <base>/api/checkout-v2 etc.
 * Request/response shapes follow UddoktaPay's, so existing plugins work unchanged.
 */
const router = express.Router({ mergeParams: true });

async function createCheckout(req, res) {
  const { invoice_id, payment_url } = await payments.createPayment(req.merchant, req.body, 'api', publicUrl(req));
  res.json({ status: true, message: 'Payment Url', payment_url, invoice_id });
}

router.post('/checkout-v2', limits.api, requireApiKey, validate(schemas.createCheckout), createCheckout);
router.post('/checkout', limits.api, requireApiKey, validate(schemas.createCheckout), createCheckout);

router.post('/verify-payment', limits.api, requireApiKey, validate(schemas.verifyPayment), async (req, res) => {
  let payment = await payments.getByInvoice(req.body.invoice_id);
  if (!payment || payment.user_id !== req.merchant.id) {
    return res.status(404).json({ status: 'ERROR', message: 'Invoice not found.' });
  }
  payment = await payments.refresh(payment);
  res.json(payments.toApiPayload(payment));
});

module.exports = router;
