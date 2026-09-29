'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  TimerOff,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { LogoMark } from '@/components/brand/logo';
import { ProviderMark } from '@/components/brand/provider-mark';
import { copyText, Spinner } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { money, dateTime, cn } from '@/lib/format';
import { PROVIDERS, paymentSteps } from '@/lib/providers';
import type { CheckoutMethod, CheckoutPayment } from '@/lib/types';

type Res = { status: boolean; message?: string; payment: CheckoutPayment };

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function goToMerchant(redirect: NonNullable<CheckoutPayment['redirect']>) {
  if (redirect.method === 'POST') {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = redirect.url;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'invoice_id';
    input.value = redirect.invoice_id;
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    return;
  }
  const url = new URL(redirect.url);
  url.searchParams.set('invoice_id', redirect.invoice_id);
  window.location.href = url.toString();
}

function useCountdown(target: string | null, serverTime: string | null) {
  const offset = useRef(0);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (serverTime) offset.current = new Date(serverTime).getTime() - Date.now();
  }, [serverTime]);
  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(target).getTime() - (Date.now() + offset.current)) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// ────────────────────────────────────────────────────────────────────────────
// Pieces
// ────────────────────────────────────────────────────────────────────────────

function MerchantHeader({ payment, onClose }: { payment: CheckoutPayment; onClose?: () => void }) {
  const m = payment.merchant;
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {m.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.logo} alt="" className="size-11 rounded-xl object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-base font-bold text-white">
            {m.brand_name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-slate-900">{m.brand_name}</p>
          <p className="truncate font-mono text-[11.5px] text-slate-400">#{payment.invoice_id}</p>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-red-50 hover:text-red-600" aria-label="Cancel payment">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function CopyChip({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(value, `${label} copied`);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:ring-slate-300"
    >
      {done ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Footer({ payment }: { payment: CheckoutPayment }) {
  const m = payment.merchant;
  return (
    <div className="mt-5 space-y-3 px-1 text-center">
      {(m.support_phone || m.support_email) && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
          <span className="font-medium text-slate-600">Need help?</span>
          {m.support_phone && (
            <a href={`tel:${m.support_phone}`} className="inline-flex items-center gap-1 hover:text-slate-800">
              <Headphones className="size-3.5" /> {m.support_phone}
            </a>
          )}
          {m.support_email && (
            <a href={`mailto:${m.support_email}`} className="inline-flex items-center gap-1 hover:text-slate-800">
              <Mail className="size-3.5" /> {m.support_email}
            </a>
          )}
        </div>
      )}
      <p className="inline-flex items-center gap-1.5 text-[12px] text-slate-400">
        <Lock className="size-3" /> Secured by <LogoMark className="size-4" /> <span className="font-semibold text-slate-500">PalkiPay</span>
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Screens
// ────────────────────────────────────────────────────────────────────────────

function SelectMethod({ payment, onPick, onCancel }: { payment: CheckoutPayment; onPick: (m: CheckoutMethod) => void; onCancel: () => void }) {
  const left = useCountdown(payment.expires_at, payment.server_time);
  return (
    <div className="animate-fade-up">
      <MerchantHeader payment={payment} onClose={onCancel} />
      <div className="mx-5 mt-5 rounded-2xl bg-brand-gradient-v p-5 text-white shadow-glow">
        <p className="text-[12px] font-medium uppercase tracking-wider text-white/75">Amount to pay</p>
        <p className="mt-1 text-[34px] font-bold leading-tight tracking-tight">{money(payment.amount)}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-white/85">
          <span className="truncate">{payment.description || payment.full_name}</span>
          {left !== null && left > 0 && left < 3600 && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 font-medium tabular-nums">Expires in {mmss(left)}</span>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-6">
        <p className="text-[13px] font-semibold text-slate-700">Choose how you want to pay</p>
        {payment.methods.length === 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
            This merchant hasn’t enabled any payment method yet. Please contact them.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {payment.methods.map((m) => {
              const p = PROVIDERS[m.provider];
              return (
                <button
                  key={m.provider}
                  onClick={() => onPick(m)}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border-2 border-slate-100 bg-white px-3 py-4 transition hover:-translate-y-0.5 hover:shadow-lift"
                  style={{ ['--pc' as string]: p.color }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${p.color}55`)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '')}
                >
                  <ProviderMark provider={m.provider} size="lg" />
                  <span className="text-[14px] font-bold text-slate-900">{p.name}</span>
                  <span className="text-[11px] font-medium text-slate-400">{m.account_type === 'agent' ? 'Cash Out' : 'Send Money'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PayWithMethod({
  payment,
  method,
  onBack,
  onSubmit,
  submitting,
}: {
  payment: CheckoutPayment;
  method: CheckoutMethod;
  onBack: () => void;
  onSubmit: (trx: string, sender: string) => void;
  submitting: boolean;
}) {
  const p = PROVIDERS[method.provider];
  const { action, steps } = paymentSteps(method.provider, method.account_type);
  const [trx, setTrx] = useState('');
  const [sender, setSender] = useState('');
  const valid = /^[A-Z0-9]{6,30}$/.test(trx);

  return (
    <div className="animate-fade-up">
      <div className="px-5 pb-6 pt-5" style={{ background: p.gradient, color: p.onColor }}>
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="grid size-9 place-items-center rounded-full bg-white/20 transition hover:bg-white/30" aria-label="Back">
            <ArrowLeft className="size-4" />
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
            <ShieldCheck className="size-3.5" /> Secure payment
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/20 text-[15px] font-extrabold">
            {{ bkash: 'bK', nagad: 'N', rocket: 'R', upay: 'U' }[method.provider]}
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">{p.name} Payment</p>
            <p className="text-[12.5px] opacity-80">
              {action} · {method.account_type === 'agent' ? 'Agent' : 'Personal'} · {payment.merchant.brand_name}
            </p>
          </div>
        </div>
        <p className="mt-5 text-[11.5px] font-medium uppercase tracking-wider opacity-75">Amount</p>
        <p className="text-[32px] font-bold leading-tight tracking-tight">{money(payment.amount)}</p>
      </div>

      <div className="-mt-3 rounded-t-3xl bg-white px-5 pb-5 pt-5">
        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3 text-[13.5px] text-slate-600">
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: p.tint, color: p.color }}>
                {i + 1}
              </span>
              <span className="flex-1">{s}</span>
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-2.5 rounded-2xl p-3.5" style={{ background: p.tint }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-medium text-slate-500">{method.account_type === 'agent' ? 'Agent number' : 'Send money to'}</p>
              <p className="font-mono text-[17px] font-bold tracking-wide text-slate-900">{method.account_number}</p>
            </div>
            <CopyChip value={method.account_number} label="Number" />
          </div>
          <div className="h-px bg-black/5" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-medium text-slate-500">Exact amount</p>
              <p className="font-mono text-[17px] font-bold text-slate-900">{payment.amount.toFixed(2)}</p>
            </div>
            <CopyChip value={payment.amount.toFixed(2)} label="Amount" />
          </div>
        </div>

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onSubmit(trx, sender);
          }}
        >
          <div>
            <label htmlFor="trx" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Transaction ID
            </label>
            <input
              id="trx"
              value={trx}
              onChange={(e) => setTrx(e.target.value.replace(/\s+/g, '').toUpperCase())}
              placeholder="e.g. 8N7A6B5C4D"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={30}
              className="h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 font-mono text-[16px] font-semibold tracking-[0.12em] text-slate-900 outline-none transition placeholder:font-sans placeholder:text-[14px] placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
              onFocus={(e) => (e.currentTarget.style.borderColor = p.color)}
              onBlur={(e) => (e.currentTarget.style.borderColor = '')}
            />
          </div>
          <div>
            <label htmlFor="sender" className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Your {p.name} number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="sender"
              type="tel"
              inputMode="numeric"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400"
              onFocus={(e) => (e.currentTarget.style.borderColor = p.color)}
              onBlur={(e) => (e.currentTarget.style.borderColor = '')}
            />
          </div>
          <button
            type="submit"
            disabled={!valid || submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold shadow-lg transition hover:brightness-105 disabled:opacity-50"
            style={{ background: p.gradient, color: p.onColor }}
          >
            {submitting && <Spinner className="size-4" />}
            Verify payment
          </button>
          <p className="text-center text-[12px] text-slate-400">
            Only pay using {action}. Payments with a wrong amount or number can’t be verified automatically.
          </p>
        </form>
      </div>
    </div>
  );
}

function Verifying({ payment, provider }: { payment: CheckoutPayment; provider: CheckoutMethod['provider'] | null }) {
  const p = provider ? PROVIDERS[provider] : null;
  const color = p?.color || '#006cfa';
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = payment.submitted_at ? new Date(payment.submitted_at).getTime() : Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
  }, [payment.submitted_at]);
  const progress = Math.min(elapsed / payment.verify_timeout_seconds, 1);
  const stage = elapsed < 3 ? 0 : elapsed < 10 ? 1 : 2;

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center animate-fade-up">
      <div className="relative grid size-28 place-items-center">
        <svg className="verify-ring absolute inset-0" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#eef2f7" strokeWidth="7" />
          <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray="70 207" />
        </svg>
        {provider ? <ProviderMark provider={provider} size="lg" /> : <LogoMark className="size-12" />}
      </div>
      <h2 className="mt-7 text-xl font-bold text-slate-900">Verifying your payment</h2>
      <p className="mt-1.5 max-w-xs text-[14px] text-slate-500">Please wait a few seconds and don’t close this page.</p>

      <ul className="mt-7 w-full max-w-xs space-y-3 text-left">
        {['Payment details received', 'Matching your transaction', 'Confirming with the merchant'].map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-[13.5px]">
            {i < stage ? (
              <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : i === stage ? (
              <span className="grid size-5 place-items-center">
                <span className="pulse-dot size-2.5 rounded-full" style={{ background: color }} />
              </span>
            ) : (
              <span className="size-5 rounded-full border-2 border-slate-200" />
            )}
            <span className={i <= stage ? 'font-medium text-slate-800' : 'text-slate-400'}>{label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(progress * 100, 6)}%`, background: color }} />
      </div>
      {payment.transaction_id && <p className="mt-3 font-mono text-[12px] text-slate-400">TrxID {payment.transaction_id}</p>}
    </div>
  );
}

function ResultScreen({
  tone,
  icon,
  title,
  message,
  payment,
  children,
}: {
  tone: 'green' | 'amber' | 'red' | 'slate';
  icon: React.ReactNode;
  title: string;
  message: React.ReactNode;
  payment: CheckoutPayment;
  children?: React.ReactNode;
}) {
  const ring = { green: 'bg-emerald-50 text-emerald-600 ring-emerald-100', amber: 'bg-amber-50 text-amber-600 ring-amber-100', red: 'bg-red-50 text-red-600 ring-red-100', slate: 'bg-slate-100 text-slate-500 ring-slate-50' }[tone];
  return (
    <div className="animate-fade-up">
      <MerchantHeader payment={payment} />
      <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
        <span className={cn('grid size-20 place-items-center rounded-full ring-8 animate-pop', ring)}>{icon}</span>
        <h2 className="mt-6 text-[22px] font-bold text-slate-900">{title}</h2>
        <div className="mt-2 max-w-sm text-[14px] leading-relaxed text-slate-500">{message}</div>
      </div>
      <dl className="mx-5 mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 text-[13.5px]">
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-slate-500">Amount</dt>
          <dd className="font-bold text-slate-900">{money(payment.amount)}</dd>
        </div>
        {payment.paid_amount != null && payment.paid_amount !== payment.amount && (
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-slate-500">Received</dt>
            <dd className="font-semibold text-slate-900">{money(payment.paid_amount)}</dd>
          </div>
        )}
        {payment.payment_method && (
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-slate-500">Method</dt>
            <dd className="flex items-center gap-2 font-semibold text-slate-900">
              <ProviderMark provider={payment.payment_method} size="xs" /> {PROVIDERS[payment.payment_method].name}
            </dd>
          </div>
        )}
        {payment.transaction_id && (
          <div className="flex justify-between gap-3 py-2.5">
            <dt className="text-slate-500">Transaction ID</dt>
            <dd className="font-mono font-semibold text-slate-900">{payment.transaction_id}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3 py-2.5">
          <dt className="text-slate-500">Date</dt>
          <dd className="font-medium text-slate-700">{dateTime(payment.completed_at || payment.submitted_at || payment.created_at)}</dd>
        </div>
      </dl>
      <div className="space-y-2 px-5 pb-5 pt-5">{children}</div>
    </div>
  );
}

function Success({ payment }: { payment: CheckoutPayment }) {
  const [left, setLeft] = useState(6);
  const redirect = payment.redirect;
  useEffect(() => {
    if (!redirect) return;
    if (left <= 0) {
      goToMerchant(redirect);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, redirect]);

  return (
    <ResultScreen
      tone="green"
      payment={payment}
      icon={
        <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      }
      title="Payment successful"
      message={<>Thank you! {payment.merchant.brand_name} has received your payment.</>}
    >
      {redirect ? (
        <button onClick={() => goToMerchant(redirect)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[15px] font-bold text-white shadow-lg transition hover:bg-emerald-700">
          Return to {payment.merchant.brand_name} {left > 0 && <span className="font-medium opacity-80">({left}s)</span>}
        </button>
      ) : (
        <p className="text-center text-[13px] text-slate-500">You can close this page now.</p>
      )}
    </ResultScreen>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const { slug, invoiceId } = useParams<{ slug: string; invoiceId: string }>();
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [method, setMethod] = useState<CheckoutMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [holdVerifying, setHoldVerifying] = useState(false);

  const base = `/api/checkout/${encodeURIComponent(invoiceId)}`;
  const qs = `?slug=${encodeURIComponent(slug)}`;

  const load = useCallback(async () => {
    try {
      const res = await api.get<Res>(`${base}${qs}`);
      setPayment(res.payment);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else toast.error(err instanceof Error ? err.message : 'Could not load payment');
    }
  }, [base, qs]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the payment is being verified.
  const status = payment?.status;
  useEffect(() => {
    if (status !== 'processing') return;
    const id = setInterval(async () => {
      try {
        const res = await api.get<Res>(`${base}/status${qs}`);
        setPayment(res.payment);
      } catch {
        // transient — keep polling
      }
    }, 2500);
    return () => clearInterval(id);
  }, [status, base, qs]);

  async function submit(trx: string, sender: string) {
    if (!method) return;
    setSubmitting(true);
    setHoldVerifying(true);
    const started = Date.now();
    try {
      const res = await api.post<Res>(`${base}/pay${qs}`, {
        provider: method.provider,
        transaction_id: trx,
        sender_number: sender || undefined,
      });
      // Keep the verifying animation up briefly so the result never flashes.
      const wait = Math.max(0, 1800 - (Date.now() - started));
      setTimeout(() => {
        setPayment(res.payment);
        setHoldVerifying(false);
        if (res.payment.status === 'failed') toast.error(res.payment.failure_reason || 'Payment verification failed');
        if (res.payment.status === 'completed') toast.success('Payment verified!');
      }, wait);
    } catch (err) {
      setHoldVerifying(false);
      toast.error(err instanceof Error ? err.message : 'Could not submit payment');
      if (err instanceof ApiError && (err.status === 409 || err.status === 410)) load();
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel() {
    if (!payment) return;
    if (!confirm('Cancel this payment?')) return;
    try {
      const res = await api.post<Res>(`${base}/cancel${qs}`);
      if (res.payment.cancel_url) window.location.href = res.payment.cancel_url;
      else setPayment(res.payment);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not cancel');
    }
  }

  let content: React.ReactNode;
  if (notFound) {
    content = (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-slate-100 text-slate-400">
          <XCircle className="size-8" />
        </span>
        <h2 className="mt-5 text-xl font-bold text-slate-900">Payment not found</h2>
        <p className="mt-1.5 text-[14px] text-slate-500">This payment link is invalid. Please go back to the store and try again.</p>
      </div>
    );
  } else if (!payment) {
    content = (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7 text-brand-600" />
      </div>
    );
  } else if (holdVerifying || payment.status === 'processing') {
    content = <Verifying payment={payment} provider={method?.provider || payment.payment_method} />;
  } else if (payment.status === 'completed') {
    content = <Success payment={payment} />;
  } else if (payment.status === 'pending') {
    content = (
      <ResultScreen
        tone="amber"
        payment={payment}
        icon={<Clock3 className="size-9" />}
        title="Payment under review"
        message={<>We couldn’t confirm it automatically yet. {payment.merchant.brand_name} will check it shortly — you don’t need to pay again.</>}
      >
        {payment.redirect && (
          <button onClick={() => goToMerchant(payment.redirect!)} className="h-12 w-full rounded-xl bg-slate-900 text-[15px] font-bold text-white">
            Return to {payment.merchant.brand_name}
          </button>
        )}
      </ResultScreen>
    );
  } else if (payment.status === 'failed') {
    content = (
      <ResultScreen
        tone="red"
        payment={payment}
        icon={<XCircle className="size-9" />}
        title="Payment failed"
        message={
          <>
            {payment.failure_reason || 'We could not verify this payment.'}
            <br />
            If money left your account, contact {payment.merchant.brand_name} with your Transaction ID.
          </>
        }
      >
        {payment.cancel_url && (
          <a href={payment.cancel_url} className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-[15px] font-bold text-white">
            Back to {payment.merchant.brand_name}
          </a>
        )}
      </ResultScreen>
    );
  } else if (payment.status === 'cancelled' || payment.status === 'expired') {
    content = (
      <ResultScreen
        tone="slate"
        payment={payment}
        icon={payment.status === 'expired' ? <TimerOff className="size-9" /> : <Ban className="size-9" />}
        title={payment.status === 'expired' ? 'Payment link expired' : 'Payment cancelled'}
        message="This payment can no longer be completed. Please start a new payment from the store."
      >
        {payment.cancel_url && (
          <a href={payment.cancel_url} className="flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-[15px] font-bold text-white">
            Back to {payment.merchant.brand_name}
          </a>
        )}
      </ResultScreen>
    );
  } else if (method) {
    content = <PayWithMethod payment={payment} method={method} onBack={() => setMethod(null)} onSubmit={submit} submitting={submitting} />;
  } else {
    content = <SelectMethod payment={payment} onPick={setMethod} onCancel={cancel} />;
  }

  return (
    <div className="min-h-screen bg-canvas bg-[radial-gradient(ellipse_at_top,rgb(0_157_250/0.12),transparent_60%)] px-3 py-6 sm:py-12">
      <div className="mx-auto w-full max-w-[440px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_24px_60px_-24px_rgb(15_23_42/0.25)]">{content}</div>
        {payment && <Footer payment={payment} />}
        {payment?.status === 'completed' && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-emerald-600">
            <CheckCircle2 className="size-3.5" /> Verified {payment.completed_at ? dateTime(payment.completed_at) : ''}
          </p>
        )}
      </div>
    </div>
  );
}
