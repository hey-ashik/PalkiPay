'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { FlaskConical, MessageSquareText, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Segmented, Skeleton } from '@/components/ui/misc';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ProviderMark } from '@/components/brand/provider-mark';
import { Pager, SearchBox } from '@/components/dashboard/pager';
import { useDashboard } from '@/components/dashboard/context';
import { api, ApiError, fetcher } from '@/lib/api';
import { money, dateTime, cn } from '@/lib/format';
import { PROVIDERS, PROVIDER_LIST } from '@/lib/providers';
import type { Pagination, SmsMessage } from '@/lib/types';

type Tab = '' | 'unused' | 'used' | 'invalid';

const STATUS: Record<SmsMessage['status'], { tone: 'blue' | 'green' | 'slate'; label: string }> = {
  unused: { tone: 'blue', label: 'Unmatched' },
  used: { tone: 'green', label: 'Matched' },
  invalid: { tone: 'slate', label: 'Ignored' },
};

function SimulateModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ provider: 'bkash', amount: '', transaction_id: '', from_number: '01712345678' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, transaction_id: Math.random().toString(36).slice(2, 12).toUpperCase() }));
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await api.post<{ status: boolean; message: string }>('/api/merchant/sms/simulate', form);
      if (res.status) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send a test SMS"
      description="Simulates a wallet SMS arriving on your phone. It goes through exactly the same matching as a real one."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Wallet" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            {PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input label="Amount (৳)" type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} placeholder="500" autoFocus />
        </div>
        <Input label="Transaction ID" value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value.toUpperCase() })} error={errors.transaction_id} inputClassName="font-mono" />
        <Input label="Sender number" value={form.from_number} onChange={(e) => setForm({ ...form, from_number: e.target.value })} error={errors.from_number} />
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-800">
          To test end-to-end: create a payment link, open it, then send a test SMS with the same Transaction ID and amount and submit that ID on the checkout page.
        </p>
        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!form.amount}>
          Send test SMS
        </Button>
      </form>
    </Modal>
  );
}

export default function SmsInboxPage() {
  const { base } = useDashboard();
  const [tab, setTab] = useState<Tab>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [simulate, setSimulate] = useState(false);

  useEffect(() => setPage(1), [tab, q]);
  const { data, mutate } = useSWR<{ data: SmsMessage[]; pagination: Pagination }>(
    `/api/merchant/sms?status=${tab}&q=${encodeURIComponent(q)}&page=${page}&limit=25`,
    fetcher,
    { refreshInterval: 10_000, keepPreviousData: true }
  );

  return (
    <>
      <PageHeader
        title="SMS inbox"
        description="Wallet messages forwarded by your phones. Unmatched messages wait for a customer to submit their Transaction ID."
        action={
          <Button variant="secondary" onClick={() => setSimulate(true)}>
            <FlaskConical className="size-4" /> Send test SMS
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: '', label: 'All' },
              { value: 'unused', label: 'Unmatched' },
              { value: 'used', label: 'Matched' },
              { value: 'invalid', label: 'Ignored' },
            ]}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search TrxID, number, text…" />
        </div>
        {!data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : data.data.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="size-5" />}
            title="No messages yet"
            description={
              <>
                Connect the phone that receives your wallet SMS on the{' '}
                <Link href={`${base}/devices`} className="font-semibold text-brand-600">
                  Devices
                </Link>{' '}
                page, or send a test SMS.
              </>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {data.data.map((m) => (
                <li key={m.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50/80" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                    <ProviderMark provider={m.provider} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[14px] font-semibold text-slate-900">{m.amount != null ? money(m.amount) : m.sender || 'Unknown sender'}</span>
                        {m.transaction_id && <span className="font-mono text-[12px] text-slate-500">{m.transaction_id}</span>}
                        <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                      </div>
                      <p className="truncate text-[12.5px] text-slate-500">
                        {m.from_number ? `From ${m.from_number}` : m.body}
                        {m.invoice_id && <> · Invoice {m.invoice_id}</>}
                        {m.device_name && <> · via {m.device_name}</>}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right text-[12px] text-slate-400 sm:block">{dateTime(m.received_at)}</div>
                    <ChevronDown className={cn('size-4 shrink-0 text-slate-300 transition', expanded === m.id && 'rotate-180')} />
                  </button>
                  {expanded === m.id && (
                    <div className="bg-slate-50/70 px-5 pb-4 pt-1">
                      <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3 font-mono text-[12px] leading-relaxed text-slate-700">{m.body}</p>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-slate-500">
                        <span>Wallet: {m.provider ? PROVIDERS[m.provider]?.name : '—'}</span>
                        <span>Sender ID: {m.sender || '—'}</span>
                        {m.balance != null && <span>Balance: {money(m.balance)}</span>}
                        <span className="sm:hidden">{dateTime(m.received_at)}</span>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Pager pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Card>
      <SimulateModal open={simulate} onClose={() => setSimulate(false)} onDone={() => mutate()} />
    </>
  );
}
