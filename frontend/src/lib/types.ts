export type ProviderId = 'bkash' | 'nagad' | 'rocket' | 'upay';

export type PaymentStatus = 'unpaid' | 'processing' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  slug: string | null;
  role: 'merchant' | 'admin';
  created_at: string;
}

export interface Session {
  user: SessionUser;
  brand: { brand_name: string; brand_logo: string | null };
  setup: {
    slug: boolean;
    payment_methods: boolean;
    device: boolean;
    telegram: boolean;
    first_payment: boolean;
  };
}

export interface Payment {
  id: number;
  invoice_id: string;
  source: 'api' | 'link';
  full_name: string;
  email: string | null;
  amount: number;
  fee: number;
  paid_amount: number | null;
  currency: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  status: PaymentStatus;
  payment_method: ProviderId | null;
  sender_number: string | null;
  transaction_id: string | null;
  verified_by: 'auto' | 'dashboard' | 'telegram' | null;
  failure_reason: string | null;
  redirect_url: string | null;
  cancel_url: string | null;
  webhook_url: string | null;
  webhook_status: 'none' | 'pending' | 'delivered' | 'failed';
  webhook_attempts: number;
  customer_ip: string | null;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  expires_at: string;
}

export interface SmsMessage {
  id: number;
  device_id: number | null;
  device_name?: string | null;
  invoice_id?: string | null;
  sender: string | null;
  body: string;
  provider: ProviderId | null;
  transaction_id: string | null;
  amount: number | null;
  from_number: string | null;
  balance: number | null;
  status: 'unused' | 'used' | 'invalid';
  payment_id: number | null;
  received_at: string;
  created_at: string;
}

export interface Device {
  id: number;
  name: string;
  platform: 'android' | 'ios' | 'other';
  device_key: string;
  is_active: boolean;
  app_version: string | null;
  last_seen_at: string | null;
  online: boolean;
  created_at: string;
  sms_count?: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CheckoutMethod {
  provider: ProviderId;
  name: string;
  ussd: string | null;
  account_type: 'personal' | 'agent';
  account_number: string;
}

export interface CheckoutPayment {
  invoice_id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  full_name: string;
  email: string | null;
  description: string | null;
  created_at: string;
  expires_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  payment_method: ProviderId | null;
  transaction_id: string | null;
  paid_amount: number | null;
  failure_reason: string | null;
  merchant: {
    slug: string;
    brand_name: string;
    logo: string | null;
    support_phone: string | null;
    support_email: string | null;
  };
  methods: CheckoutMethod[];
  cancel_url: string | null;
  redirect: { url: string; method: 'GET' | 'POST'; invoice_id: string } | null;
  verify_timeout_seconds: number;
  server_time: string;
}
