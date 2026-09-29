'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeftRight, Plus, RefreshCw } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, Segmented, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/field';
import { PaymentsTable } from '@/components/dashboard/payments-table';
import { PaymentDrawer } from '@/components/dashboard/payment-drawer';
import { CreateLinkModal } from '@/components/dashboard/create-link-modal';
import { Pager, SearchBox } from '@/components/dashboard/pager';
import { useDashboard } from '@/components/dashboard/context';
import { fetcher } from '@/lib/api';
import { PROVIDER_LIST } from '@/lib/providers';
import type { Pagination, Payment } from '@/lib/types';

type Tab = 'all' | 'completed' | 'pending' | 'failed' | 'unpaid' | 'closed';

interface ListResponse {
  data: Payment[];
  pagination: Pagination;
  counts: Record<Tab, number>;
}

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Transactions() {
  const params = useSearchParams();
  const { refreshSession } = useDashboard();
  const [tab, setTab] = useState<Tab>((params.get('status') as Tab) || 'all');
  const [q, setQ] = useState('');
  const [provider, setProvider] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(params.get('invoice'));
  const [linkOpen, setLinkOpen] = useState(false);
  const query = useDebounced(q);

  useEffect(() => setPage(1), [tab, query, provider]);

  const url = `/api/merchant/payments?status=${tab === 'all' ? '' : tab}&q=${encodeURIComponent(query)}&provider=${provider}&page=${page}&limit=20`;
  const { data, mutate, isValidating } = useSWR<ListResponse>(url, fetcher, { refreshInterval: 15_000, keepPreviousData: true });

  const c = data?.counts;
  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every payment created through your API or payment links."
        action={
          <>
            <Button variant="secondary" onClick={() => mutate()} aria-label="Refresh">
              <RefreshCw className={isValidating ? 'size-4 animate-spin' : 'size-4'} />
            </Button>
            <Button onClick={() => setLinkOpen(true)}>
              <Plus className="size-4" /> Create payment link
            </Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All', count: c?.all },
              { value: 'completed', label: 'Completed', count: c?.completed },
              { value: 'pending', label: 'Needs review', count: c?.pending },
              { value: 'failed', label: 'Failed', count: c?.failed },
              { value: 'unpaid', label: 'Unpaid', count: c?.unpaid },
              { value: 'closed', label: 'Closed', count: c?.closed },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={provider} onChange={(e) => setProvider(e.target.value)} className="sm:w-40" aria-label="Wallet">
              <option value="">All wallets</option>
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <SearchBox value={q} onChange={setQ} placeholder="Search name, invoice, TrxID, phone…" />
          </div>
        </div>
        {!data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : data.data.length ? (
          <>
            <PaymentsTable payments={data.data} onSelect={(p) => setSelected(p.invoice_id)} />
            <Pager pagination={data.pagination} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon={<ArrowLeftRight className="size-5" />}
            title={q || provider || tab !== 'all' ? 'No matching payments' : 'No payments yet'}
            description={q || provider || tab !== 'all' ? 'Try another filter or search term.' : 'Payments appear here as soon as they are created.'}
          />
        )}
      </Card>
      <PaymentDrawer
        invoiceId={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          mutate();
          refreshSession();
        }}
      />
      <CreateLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} onCreated={() => mutate()} />
    </>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <Transactions />
    </Suspense>
  );
}
