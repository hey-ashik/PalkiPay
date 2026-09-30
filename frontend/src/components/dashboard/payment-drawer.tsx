'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, ExternalLink, XCircle, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Drawer, Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { StatusBadge, Badge } from '@/components/ui/badge';
import { CopyButton, Skeleton } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/field';
import { ProviderMark } from '@/components/brand/provider-mark';
import { api, fetcher } from '@/lib/api';
import { money, dateTime } from '@/lib/format';
import { PROVIDERS } from '@/lib/providers';
import type { Payment, SmsMessage } from '@/lib/types';

interface Detail {
  payment: Payment;
  sms: SmsMessage | null;
  checkout_url: string;
}

const VERIFIED_BY = { auto: 'Automatically (SMS match)', dashboard: 'Manually from dashboard', telegram: 'Manually via Telegram' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13.5px]">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export function PaymentDrawer({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, mutate } = useSWR<Detail>(invoiceId ? `/api/merchant/payments/${invoiceId}` : null, fetcher);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const p = data?.payment;

  const canApprove = p && ['unpaid', 'processing', 'pending', 'failed', 'expired'].includes(p.status);
  const canReject = p && ['unpaid', 'processing', 'pending', 'failed'].includes(p.status);

  async function act(kind: 'approve' | 'reject') {
    if (!p) return;
    setBusy(kind);
    try {
      const res = await api.post<{ message: string }>(`/api/merchant/payments/${p.invoice_id}/${kind}`, kind === 'reject' ? { reason } : {});
      toast.success(res.message);
      setRejectOpen(false);
      setReason('');
      await mutate();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Drawer
        open={Boolean(invoiceId)}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            Payment details {p && <StatusBadge status={p.status} />}
          </span>
        }
        footer={
          p && (canApprove || canReject) ? (
            <>
              {canReject && (
                <Button variant="danger" className="flex-1" onClick={() => setRejectOpen(true)} disabled={busy !== null}>
                  <XCircle className="size-4" /> Reject
                </Button>
              )}
              {canApprove && (
                <Button variant="success" className="flex-1" onClick={() => act('approve')} loading={busy === 'approve'}>
                  <CheckCircle2 className="size-4" /> Approve payment
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {!p ? (
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-48" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-canvas p-5 text-center">
              <p className="text-[12.5px] font-medium text-slate-500">Amount</p>
              <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{money(p.amount)}</p>
              {p.paid_amount != null && p.paid_amount !== p.amount && (
                <p className={p.paid_amount < p.amount ? 'mt-1 text-sm font-semibold text-red-600' : 'mt-1 text-sm font-semibold text-emerald-600'}>
                  Received {money(p.paid_amount)}
                </p>
              )}
              {p.failure_reason && <p className="mx-auto mt-3 max-w-xs rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{p.failure_reason}</p>}
              {p.status === 'pending' && (
                <p className="mx-auto mt-3 max-w-xs rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
                  No matching SMS arrived in time. Check your wallet, then approve or reject.
                </p>
              )}
            </div>

            <section>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Customer</h3>
              <dl className="mt-1 divide-y divide-slate-100">
                <Row label="Name">{p.full_name}</Row>
                <Row label="Email">{p.email || '—'}</Row>
                {p.description && <Row label="Description">{p.description}</Row>}
              </dl>
            </section>

            <section>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Payment</h3>
              <dl className="mt-1 divide-y divide-slate-100">
                <Row label="Invoice">
                  <span className="inline-flex items-center gap-1 font-mono text-[12.5px]">
                    {p.invoice_id} <CopyButton value={p.invoice_id} label="Invoice ID copied" />
                  </span>
                </Row>
                <Row label="Method">
                  {p.payment_method ? (
                    <span className="inline-flex items-center gap-2">
                      <ProviderMark provider={p.payment_method} size="xs" /> {PROVIDERS[p.payment_method]?.name}
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Sender">{p.sender_number || '—'}</Row>
                <Row label="Transaction ID">
                  {p.transaction_id ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[12.5px]">
                      {p.transaction_id} <CopyButton value={p.transaction_id} label="Transaction ID copied" />
                    </span>
                  ) : (
                    '—'
                  )}
                </Row>
                <Row label="Verified">{p.verified_by ? VERIFIED_BY[p.verified_by] : '—'}</Row>
                <Row label="Source">{p.source === 'link' ? 'Payment link' : 'API'}</Row>
              </dl>
            </section>

            {data.sms && (
              <section>
                <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                  <MessageSquareText className="size-3.5" /> Matched SMS
                </h3>
                <p className="mt-2 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[12px] leading-relaxed text-slate-700">
                  {data.sms.body}
                </p>
              </section>
            )}

            <section>
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Timeline</h3>
              <dl className="mt-1 divide-y divide-slate-100">
                <Row label="Created">{dateTime(p.created_at)}</Row>
                <Row label="Submitted">{dateTime(p.submitted_at)}</Row>
                <Row label="Completed">{dateTime(p.completed_at)}</Row>
                <Row label="Link expires">{dateTime(p.expires_at)}</Row>
              </dl>
            </section>

            {(p.webhook_url || p.webhook_status !== 'none') && (
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Webhook</h3>
                <dl className="mt-1 divide-y divide-slate-100">
                  <Row label="URL">
                    <span className="block max-w-56 truncate">{p.webhook_url || 'Default webhook'}</span>
                  </Row>
                  <Row label="Delivery">
                    <Badge tone={p.webhook_status === 'delivered' ? 'green' : p.webhook_status === 'failed' ? 'red' : 'slate'}>
                      {p.webhook_status} · {p.webhook_attempts} attempt{p.webhook_attempts === 1 ? '' : 's'}
                    </Badge>
                  </Row>
                </dl>
              </section>
            )}

            {p.metadata && Object.keys(p.metadata).length > 0 && (
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Metadata</h3>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-navy-950 p-3 font-mono text-[12px] text-slate-200">
                  {JSON.stringify(p.metadata, null, 2)}
                </pre>
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton value={data.checkout_url} label="Checkout link copied">
                Copy checkout link
              </CopyButton>
              <a
                href={data.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-600 hover:ring-brand-200"
              >
                <ExternalLink className="size-3.5" /> Open checkout
              </a>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        size="sm"
        title="Reject this payment?"
        description="The customer’s payment will be marked as failed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => act('reject')} loading={busy === 'reject'}>
              Reject payment
            </Button>
          </>
        }
      >
        <Textarea label="Reason" optional placeholder="e.g. No money received for this Transaction ID" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </Modal>
    </>
  );
}
