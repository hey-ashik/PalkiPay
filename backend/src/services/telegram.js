'use strict';

const db = require('../db/pool');
const config = require('../config');
const events = require('./events');
const merchants = require('./merchants');
const { PROVIDERS } = require('./providers');

// ────────────────────────────────────────────────────────────────────────────
// Bot API client
// ────────────────────────────────────────────────────────────────────────────

async function call(token, method, body = {}, { signal, timeoutMs = 15000 } = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!data.ok) {
    const err = new Error(data.description || 'Telegram API error');
    err.code = data.error_code;
    throw err;
  }
  return data.result;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (v) => `৳${Number(v).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const linkCode = (settings) => String(settings.telegram_secret || '').slice(0, 16);
const deepLink = (settings) =>
  settings.telegram_bot_username ? `https://t.me/${settings.telegram_bot_username}?start=${linkCode(settings)}` : null;

// ────────────────────────────────────────────────────────────────────────────
// Message templates
// ────────────────────────────────────────────────────────────────────────────

const HEADLINES = {
  completed: '✅ <b>Payment received</b>',
  review: '🟡 <b>Payment needs your review</b>',
  insufficient: '⚠️ <b>Insufficient payment</b>',
  rejected: '❌ <b>Payment rejected</b>',
};

function paymentText(kind, { payment: p, merchant, settings }, footer) {
  const provider = PROVIDERS[p.payment_method]?.name || p.payment_method || '—';
  const lines = [
    HEADLINES[kind],
    '',
    `🏪 ${esc(settings.brand_name || merchant.name)}`,
    `🧾 Invoice: <code>${esc(p.invoice_id)}</code>`,
    `👤 ${esc(p.full_name)}${p.email ? ` (${esc(p.email)})` : ''}`,
    `💰 Amount: <b>${money(p.amount)}</b>`,
  ];
  if (p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount)) {
    lines.push(`💵 Received: <b>${money(p.paid_amount)}</b>`);
  }
  lines.push(`📱 Method: ${esc(provider)}${p.sender_number ? ` · ${esc(p.sender_number)}` : ''}`);
  if (p.transaction_id) lines.push(`🔖 TrxID: <code>${esc(p.transaction_id)}</code>`);
  if (kind === 'review') {
    lines.push('', `No matching SMS arrived within ${config.payments.verifyTimeoutSeconds}s. Check your wallet and decide:`);
  }
  if (kind === 'insufficient' && p.failure_reason) lines.push('', esc(p.failure_reason));
  if (footer) lines.push('', footer);
  return lines.join('\n');
}

const decisionKeyboard = (invoiceId) => ({
  inline_keyboard: [
    [
      { text: '✅ Approve', callback_data: `a:${invoiceId}` },
      { text: '❌ Reject', callback_data: `r:${invoiceId}` },
    ],
  ],
});

function isReady(settings) {
  return Boolean(settings?.telegram_enabled && settings.telegram_bot_token && settings.telegram_chat_id);
}

async function send(settings, text, replyMarkup) {
  return call(settings.telegram_bot_token, 'sendMessage', {
    chat_id: settings.telegram_chat_id,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

/** Post a new message, or update the existing review message for this payment. */
async function publish(ctx, kind, { withButtons = false, footer } = {}) {
  const { payment, settings } = ctx;
  if (!isReady(settings)) return;
  const text = paymentText(kind, ctx, footer);
  const markup = withButtons ? decisionKeyboard(payment.invoice_id) : { inline_keyboard: [] };

  if (payment.telegram_message_id && !withButtons) {
    try {
      await call(settings.telegram_bot_token, 'editMessageText', {
        chat_id: settings.telegram_chat_id,
        message_id: payment.telegram_message_id,
        text,
        parse_mode: 'HTML',
        reply_markup: markup,
      });
      return;
    } catch {
      // Message too old or deleted — fall through and send a fresh one.
    }
  }
  const msg = await send(settings, text, withButtons ? markup : undefined);
  await db.query('UPDATE payments SET telegram_message_id = ? WHERE id = ?', [msg.message_id, payment.id]);
}

const VIA_LABEL = { auto: 'Verified automatically by SMS', dashboard: 'Approved from dashboard', telegram: 'Approved via Telegram' };

events.on('payment.completed', (ctx) => publish(ctx, 'completed', { footer: `<i>${VIA_LABEL[ctx.via] || ''}</i>` }));
events.on('payment.review', (ctx) => publish(ctx, 'review', { withButtons: true }));
events.on('payment.failed', (ctx) =>
  ctx.reason === 'insufficient'
    ? publish(ctx, 'insufficient', { withButtons: true })
    : publish(ctx, 'rejected', { footer: `<i>${ctx.via === 'telegram' ? 'Rejected via Telegram' : 'Rejected from dashboard'}</i>` })
);

// ────────────────────────────────────────────────────────────────────────────
// Incoming updates (webhook or polling)
// ────────────────────────────────────────────────────────────────────────────

async function handleUpdate(userId, update) {
  const settings = await merchants.getSettings(userId);
  const token = settings.telegram_bot_token;
  if (!token) return;

  if (update.message?.text) {
    const { chat, text } = update.message;
    const [command, arg] = text.trim().split(/\s+/);
    if (!/^\/start(@\w+)?$/i.test(command)) return;

    const chatId = String(chat.id);
    if (arg && arg === linkCode(settings)) {
      await db.query('UPDATE merchant_settings SET telegram_chat_id = ?, telegram_enabled = 1 WHERE user_id = ?', [
        chatId,
        userId,
      ]);
      await call(token, 'sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `✅ <b>PalkiPay connected!</b>\n\nPayment notifications for <b>${esc(settings.brand_name || 'your store')}</b> will arrive here. You can approve or reject payments that need review right from this chat.`,
      });
    } else if (chatId === settings.telegram_chat_id) {
      await call(token, 'sendMessage', { chat_id: chatId, text: '✅ This chat is connected to PalkiPay.' });
    } else {
      await call(token, 'sendMessage', {
        chat_id: chatId,
        text: 'To link this bot, open your PalkiPay dashboard → Telegram and use the “Connect” button there.',
      });
    }
    return;
  }

  const cb = update.callback_query;
  if (!cb?.data) return;
  const answer = (text) => call(token, 'answerCallbackQuery', { callback_query_id: cb.id, text, show_alert: false }).catch(() => {});

  if (String(cb.message?.chat?.id) !== String(settings.telegram_chat_id)) return answer('This chat is not authorised.');

  const [action, invoiceId] = cb.data.split(':');
  const payments = require('./payments'); // lazy: payments ↔ telegram are independent at load time
  const payment = await payments.getByInvoice(invoiceId);
  if (!payment || payment.user_id !== userId) return answer('Payment not found.');

  try {
    if (action === 'a') {
      await payments.approvePayment(payment, { by: 'telegram' });
      await answer('Payment approved ✅');
    } else if (action === 'r') {
      await payments.rejectPayment(payment, { by: 'telegram' });
      await answer('Payment rejected');
    }
  } catch (err) {
    await answer(err.message);
    // Remove stale buttons so nobody taps them again.
    await call(token, 'editMessageReplyMarkup', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {});
  }
}

// ── Polling mode (local development) ────────────────────────────────────────

const pollers = new Map(); // userId -> { token, controller }

function stopPolling(userId) {
  const p = pollers.get(userId);
  if (p) {
    p.controller.abort();
    pollers.delete(userId);
  }
}

function startPolling(userId, token) {
  if (pollers.get(userId)?.token === token) return;
  stopPolling(userId);
  const controller = new AbortController();
  pollers.set(userId, { token, controller });

  (async () => {
    let offset = 0;
    await call(token, 'deleteWebhook', {}).catch(() => {});
    while (!controller.signal.aborted) {
      try {
        const updates = await call(
          token,
          'getUpdates',
          { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] },
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]) }
        );
        for (const u of updates) {
          offset = u.update_id + 1;
          await handleUpdate(userId, u).catch((e) => console.error('[telegram] update failed:', e.message));
        }
      } catch (err) {
        if (controller.signal.aborted) break;
        if (err.code === 401 || err.code === 404) {
          console.error(`[telegram] bot token for merchant ${userId} is invalid — polling stopped`);
          stopPolling(userId);
          break;
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();
}

// ── Connect / disconnect ────────────────────────────────────────────────────

const webhookUrl = (userId) => `${config.appUrl}/api/telegram/webhook/${userId}`;

/** Point Telegram at this server for the given merchant (webhook or polling). */
async function activate(userId, settings) {
  if (config.telegram.mode === 'polling') {
    startPolling(userId, settings.telegram_bot_token);
    return;
  }
  await call(settings.telegram_bot_token, 'setWebhook', {
    url: webhookUrl(userId),
    secret_token: settings.telegram_secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

async function deactivate(userId, token) {
  stopPolling(userId);
  if (token) await call(token, 'deleteWebhook', {}).catch(() => {});
}

/** On boot, resume polling for every merchant with a bot (polling mode only). */
async function bootstrap() {
  if (config.telegram.mode !== 'polling') return;
  const rows = await db.query('SELECT user_id, telegram_bot_token FROM merchant_settings WHERE telegram_bot_token IS NOT NULL');
  for (const r of rows) startPolling(r.user_id, r.telegram_bot_token);
  if (rows.length) console.log(`[telegram] polling ${rows.length} bot(s)`);
}

async function sendTest(settings) {
  return send(
    settings,
    `🔔 <b>PalkiPay test message</b>\n\nYour Telegram notifications for <b>${esc(settings.brand_name || 'your store')}</b> are working.`
  );
}

module.exports = {
  call,
  handleUpdate,
  activate,
  deactivate,
  bootstrap,
  sendTest,
  deepLink,
  isReady,
};
