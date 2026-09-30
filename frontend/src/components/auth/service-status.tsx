'use client';

import useSWR from 'swr';
import { AlertTriangle } from 'lucide-react';
import { fetcher } from '@/lib/api';

interface Health {
  database: string;
  web: string;
}

/** Tells people up front when sign-up / sign-in can't work because the database is down. */
export function ServiceStatus() {
  const { data } = useSWR<Health>('/api/health', fetcher, { refreshInterval: 30_000, shouldRetryOnError: false });
  if (!data || data.database === 'ok') return null;
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900" role="alert">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">Accounts are temporarily unavailable</p>
        <p className="mt-0.5 text-amber-800">
          PalkiPay can’t reach its database right now, so you can’t sign up or sign in yet. Please try again in a few minutes.
        </p>
      </div>
    </div>
  );
}
