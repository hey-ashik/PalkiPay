'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Link2, Plus, Share2, Smartphone, Zap } from 'lucide-react';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { PaymentsTable } from '@/components/dashboard/payments-table';
import { PaymentDrawer } from '@/components/dashboard/payment-drawer';
import { CreateLinkModal } from '@/components/dashboard/create-link-modal';
import { Pager } from '@/components/dashboard/pager';
import { fetcher } from '@/lib/api';
import type { Pagination, Payment } from '@/lib/types';

export default function PaymentLinksPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, mutate } = useSWR<{ data: Payment[]; pagination: Pagination }>(
    `/api/merchant/payments?source=link&page=${page}&limit=15`,
    fetcher,
    { refreshInterval: 15_000, keepPreviousData: true }
  );

  return (
    <>
      <PageHeader
        title="Payment links"
        description="Collect money on Facebook, WhatsApp or anywhere — no website needed."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New payment link
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          { icon: Plus, title: 'Create', text: 'Enter the amount and, optionally, the customer’s details.' },
          { icon: Share2, title: 'Share', text: 'Send the link in Messenger, WhatsApp, SMS or email.' },
          { icon: Zap, title: 'Get paid', text: 'The customer pays by bKash, Nagad, Rocket or Upay and it’s verified automatically.' },
        ].map(({ icon: Icon, title, text }) => (
          <Card key={title} className="flex items-start gap-3 p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="text-[14.5px] font-semibold text-slate-900">{title}</h3>
              <p className="mt-0.5 text-[13px] text-slate-500">{text}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Your payment links" description="Links expire automatically if unpaid." />
        {!data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : data.data.length ? (
          <>
            <PaymentsTable payments={data.data} onSelect={(p) => setSelected(p.invoice_id)} compact />
            <Pager pagination={data.pagination} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<Link2 className="size-5" />}
            title="No payment links yet"
            description={
              <>
                Create one and open it on your phone to see exactly what your customers see.
                <span className="mt-2 flex items-center justify-center gap-1 text-slate-400">
                  <Smartphone className="size-3.5" /> Tip: great for testing your setup
                </span>
              </>
            }
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Create payment link
              </Button>
            }
          />
        )}
      </Card>

      <PaymentDrawer invoiceId={selected} onClose={() => setSelected(null)} onChanged={() => mutate()} />
      <CreateLinkModal open={open} onClose={() => setOpen(false)} onCreated={() => mutate()} />
    </>
  );
}
