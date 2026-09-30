'use strict';

const { z } = require('zod');
const { PROVIDER_IDS } = require('../services/providers');

const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Must be a valid http(s) URL');

const optionalUrl = z.preprocess((v) => (v === '' || v == null ? undefined : v), httpUrl.optional());
const optionalString = (max) => z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().max(max).optional());

const bdPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .refine((v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v), 'Enter a valid Bangladeshi mobile number (01XXXXXXXXX)')
  .transform((v) => v.slice(-11));

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100)
  .refine((v) => /[a-z]/.test(v), 'Password must contain a lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Password must contain an uppercase letter')
  .refine((v) => /\d/.test(v), 'Password must contain a number');

const amount = z.coerce
  .number({ error: 'Amount must be a number' })
  .positive('Amount must be greater than 0')
  .max(10_000_000, 'Amount is too large')
  .transform((v) => Math.round(v * 100) / 100);

/** Metadata may arrive as an object or as a JSON string (UddoktaPay style). */
const metadata = z.preprocess((v) => {
  if (v === '' || v == null) return undefined;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return { value: v };
    }
  }
  return v;
}, z.record(z.string(), z.any()).optional().refine((v) => v === undefined || JSON.stringify(v).length <= 5000, 'Metadata is too large'));

const schemas = {
  register: z.object({
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: z.email('Enter a valid email address').trim().toLowerCase().max(190),
    phone: z.preprocess((v) => (v === '' || v == null ? undefined : v), bdPhone.optional()),
    password,
    slug: z.string().trim().toLowerCase().optional(),
  }),

  login: z.object({
    email: z.email('Enter a valid email address').trim().toLowerCase(),
    password: z.string().min(1, 'Enter your password'),
    remember: z.boolean().optional(),
  }),

  claimSlug: z.object({ slug: z.string().trim().toLowerCase() }),

  profile: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.preprocess((v) => (v === '' || v == null ? null : v), bdPhone.nullable()),
  }),

  changePassword: z.object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: password,
  }),

  /** Merchant API — create a checkout (UddoktaPay-compatible body). */
  createCheckout: z.object({
    full_name: z.string().trim().min(1, 'full_name is required').max(150),
    email: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.email('email must be valid').max(190).optional()),
    amount,
    metadata,
    redirect_url: optionalUrl,
    cancel_url: optionalUrl,
    webhook_url: optionalUrl,
    return_type: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['GET', 'POST']).default('GET')),
    description: optionalString(255),
  }),

  /** Dashboard — create a payment link. */
  createLink: z.object({
    amount,
    full_name: z.preprocess((v) => (v === '' || v == null ? 'Customer' : v), z.string().trim().max(150)),
    email: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.email().max(190).optional()),
    description: optionalString(255),
    redirect_url: optionalUrl,
  }),

  verifyPayment: z.object({ invoice_id: z.string().trim().min(1, 'invoice_id is required').max(32) }),

  submitPayment: z.object({
    provider: z.enum(PROVIDER_IDS, { error: 'Choose a payment method' }),
    transaction_id: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, '').toUpperCase())
      .refine((v) => /^[A-Z0-9]{6,30}$/.test(v), 'Enter a valid transaction ID'),
    sender_number: z.preprocess((v) => (v === '' || v == null ? undefined : v), bdPhone.optional()),
  }),

  paymentMethod: z.object({
    account_type: z.enum(['personal', 'agent']).default('personal'),
    account_number: bdPhone,
    is_active: z.boolean().default(true),
  }),

  brand: z.object({
    brand_name: z.string().trim().min(2).max(120),
    brand_logo: z.preprocess(
      (v) => (v === '' ? null : v),
      z
        .string()
        .max(400_000, 'Logo image is too large (max ~300 KB)')
        .refine((v) => /^data:image\/(png|jpe?g|webp|svg\+xml);base64,/.test(v) || /^https?:\/\//.test(v), 'Logo must be an image')
        .nullable()
        .optional()
    ),
    support_phone: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().trim().max(30).nullable()),
    support_email: z.preprocess((v) => (v === '' || v == null ? null : v), z.email().max(190).nullable()),
    default_webhook_url: z.preprocess((v) => (v === '' || v == null ? null : v), httpUrl.nullable()),
  }),

  telegram: z.object({
    bot_token: z
      .string()
      .trim()
      .regex(/^\d{5,15}:[A-Za-z0-9_-]{30,50}$/, 'That does not look like a bot token from @BotFather')
      .optional(),
    chat_id: z.preprocess(
      (v) => (v === '' ? null : v),
      z.string().trim().regex(/^-?\d{3,20}$|^@\w{4,}$/, 'Chat ID must be a number (or @channel)').nullable().optional()
    ),
    enabled: z.boolean().optional(),
  }),

  device: z.object({
    name: z.string().trim().min(1, 'Name your device').max(80),
    platform: z.enum(['android', 'ios', 'other']).default('android'),
  }),

  deviceUpdate: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    is_active: z.boolean().optional(),
  }),

  deviceLogin: z.object({
    email: z.email().trim().toLowerCase(),
    password: z.string().min(1),
    device_name: z.string().trim().max(80).default('My phone'),
    platform: z.enum(['android', 'ios', 'other']).default('android'),
    app_version: optionalString(20),
  }),

  smsIn: z.object({
    sender: optionalString(60),
    message: z.string().trim().min(1, 'message is required').max(2000),
    received_at: z.union([z.string(), z.number()]).optional(),
    provider: z.preprocess((v) => (v === '' || v == null ? undefined : String(v).toLowerCase()), z.enum(PROVIDER_IDS).optional()),
  }),

  smsSimulate: z.object({
    provider: z.enum(PROVIDER_IDS),
    amount,
    transaction_id: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9]{6,30}$/.test(v), 'Enter a valid transaction ID'),
    from_number: bdPhone,
  }),

  reject: z.object({ reason: optionalString(200) }),
};

module.exports = schemas;
