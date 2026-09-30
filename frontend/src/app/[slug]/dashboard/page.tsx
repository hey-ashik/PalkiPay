'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Link2,
  Plus,
  Smartphone,
  TrendingUp,
  Wallet,
  XCircle,
  Send,
  Code2,
  Circle,
  ArrowLeftRight,
} from 'lucide-react';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { ProviderMark } from '@/components/brand/provider-mark';
import { RevenueChart } from '@/components/dashboard/revenue-chart';
import { PaymentsTable } from '@/components/dashboard/payments-table';
import { PaymentDrawer } from '@/components/dashboard/payment-drawer';
import { CreateLinkModal } from '@/components/dashboard/create-link-modal';
import { useDashboard } from '@/components/dashboard/context';
import { fetcher } from '@/lib/api';
import { greeting, money, moneyShort, cn } from '@/lib/format';
import { PROVIDERS } from '@/lib/providers';
import type { Payment, ProviderId } from '@/lib/types';

interface Overview {
  totals: {
    total_revenue: number;
    today_revenue: number;
    today_count: number;
    completed: number;
    pending: number;
    failed: number;
    unpaid: number;
    total: number;
  };
  chart: { day: string; revenue: number; count: number }[];
  providers: { provider: ProviderId; revenue: number; count: number }[];
  recent: Payment[];
  devices: { total: number; online: number };
  sms: { unused: number; used: number; invalid: number };
}

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: 'blue' | 'green' | 'amber' | 'red';
  href?: string;
}) {
  const tones = {
    blue: 'bg-brand-50 text-brand-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  const body = (
    <Card className={cn('h-full p-5 transition', href && 'hover:border-brand-200 hover:shadow-lift')}>
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <span className={cn('grid size-8 place-items-center rounded-lg', tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-[26px] font-bold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SetupChecklist({ onCreateLink }: { onCreateLink: () => void }) {
  const { session, base } = useDashboard();
  const steps = [
    { done: session.setup.payment_methods, label: 'Add a bKash, Nagad, Rocket or Upay number', href: `${base}/payment-methods`, icon: Wallet },
    { done: session.setup.device, label: 'Connect the phone that receives wallet SMS', href: `${base}/devices`, icon: Smartphone },
    { done: session.setup.telegram, label: 'Get payment alerts on Telegram', href: `${base}/telegram`, icon: Send },
    { done: session.setup.first_payment, label: 'Create your first payment', href: null, icon: Code2 },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Finish setting up PalkiPay</h2>
          <p className="text-[13px] text-slate-500">
            {done} of {steps.length} steps complete — you’ll be accepting automated payments after these.
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-brand-100">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>
      <ul className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
        {steps.map((s) => {
          const inner = (
            <span className="flex items-center gap-3 px-5 py-3.5">
              {s.done ? <CheckCircle2 className="size-5 shrink-0 text-emerald-500" /> : <Circle className="size-5 shrink-0 text-slate-300" />}
              <span className={cn('text-[13.5px]', s.done ? 'text-slate-400 line-through' : 'font-medium text-slate-700')}>{s.label}</span>
              {!s.done && <ArrowRight className="ml-auto size-4 shrink-0 text-slate-300" />}
            </span>
          );
          return (
            <li key={s.label} className="transition hover:bg-slate-50/70">
              {s.done ? inner : s.href ? <Link href={s.href}>{inner}</Link> : <button className="w-full text-left" onClick={onCreateLink}>{inner}</button>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function OverviewPage() {
  const { session, base, refreshSession } = useDashboard();
  const { data, mutate } = useSWR<Overview>('/api/merchant/overview', fetcher, { refreshInterval: 20_000 });
  const [selected, setSelected] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  const refresh = () => {
    mutate();
    refreshSession();
  };

  const providerMax = Math.max(...(data?.providers.map((p) => p.revenue) || [0]), 1);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${session.user.name.split(' ')[0]}`}
        description="Here’s how your payments are doing."
        action={
          <>
            <Link href={`${base}/transactions`} className="hidden sm:block">
              <Button variant="secondary">
                <ArrowLeftRight className="size-4" /> Transactions
              </Button>
            </Link>
            <Button onClick={() => setLinkOpen(true)}>
              <Plus className="size-4" /> Create payment link
            </Button>
          </>
        }
      />

      <SetupChecklist onCreateLink={() => setLinkOpen(true)} />

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-2xl" />
          ))}
          <Skeleton className="h-80 rounded-2xl sm:col-span-2 xl:col-span-3" />
          <Skeleton className="h-80 rounded-2xl sm:col-span-2 xl:col-span-1" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Total revenue" value={moneyShort(data.totals.total_revenue)} sub={`${data.totals.completed} completed payments`} icon={TrendingUp} tone="blue" />
            <StatTile label="Today" value={moneyShort(data.totals.today_revenue)} sub={`${data.totals.today_count} payment${data.totals.today_count === 1 ? '' : 's'} today`} icon={CheckCircle2} tone="green" />
            <StatTile
              label="Needs review"
              value={String(data.totals.pending)}
              sub={data.totals.pending ? 'Tap to approve or reject' : 'Nothing waiting'}
              icon={Clock3}
              tone="amber"
              href={`${base}/transactions?status=pending`}
            />
            <StatTile label="Failed" value={String(data.totals.failed)} sub={`${data.totals.unpaid} unpaid links open`} icon={XCircle} tone="red" href={`${base}/transactions?status=failed`} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <RevenueChart data={data.chart} />
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader title="Revenue by wallet" description="All-time completed payments" />
                <div className="space-y-4 px-5 py-4">
                  {data.providers.length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-slate-500">No completed payments yet</p>
                  ) : (
                    data.providers.map((p) => (
                      <div key={p.provider}>
                        <div className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="flex items-center gap-2 font-medium text-slate-700">
                            <ProviderMark provider={p.provider} size="xs" />
                            {PROVIDERS[p.provider]?.name || p.provider}
                          </span>
                          <span className="tabular-nums text-slate-900">
                            {money(p.revenue)} <span className="text-slate-400">· {p.count}</span>
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-brand-50">
                          <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max((p.revenue / providerMax) * 100, 2)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-slate-500">SMS forwarding</p>
                  <Link href={`${base}/devices`} className="text-[12.5px] font-semibold text-brand-600 hover:text-brand-700">
                    Manage
                  </Link>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className={cn('grid size-10 place-items-center rounded-xl', data.devices.online ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
                    <Smartphone className="size-5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">
                      {data.devices.online} of {data.devices.total} device{data.devices.total === 1 ? '' : 's'} online
                    </p>
                    <p className="text-[12.5px] text-slate-500">
                      {data.sms.unused} unmatched · {data.sms.used} matched · {data.sms.invalid} ignored SMS
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader
              title="Recent payments"
              action={
                <Link href={`${base}/transactions`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {data.recent.length ? (
              <PaymentsTable payments={data.recent} onSelect={(p) => setSelected(p.invoice_id)} compact />
            ) : (
              <EmptyState
                icon={<Link2 className="size-5" />}
                title="No payments yet"
                description="Create a payment link or integrate the API to receive your first payment."
                action={
                  <Button onClick={() => setLinkOpen(true)}>
                    <Plus className="size-4" /> Create payment link
                  </Button>
                }
              />
            )}
          </Card>
        </>
      )}

      <PaymentDrawer invoiceId={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      <CreateLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} onCreated={refresh} />
    </>
  );
}
