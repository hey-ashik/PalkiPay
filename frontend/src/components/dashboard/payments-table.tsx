'use client';

import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/badge';
import { ProviderMark } from '@/components/brand/provider-mark';
import { money, dateTime, cn } from '@/lib/format';
import { PROVIDERS } from '@/lib/providers';
import type { Payment } from '@/lib/types';

export function PaymentsTable({
  payments,
  onSelect,
  compact = false,
}: {
  payments: Payment[];
  onSelect: (p: Payment) => void;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[12px] text-slate-500">
            <th className="px-5 py-3 font-semibold">Customer</th>
            <th className="px-3 py-3 font-semibold">Method</th>
            {!compact && <th className="px-3 py-3 font-semibold">Transaction ID</th>}
            <th className="px-3 py-3 text-right font-semibold">Amount</th>
            <th className="px-3 py-3 font-semibold">Status</th>
            <th className="px-3 py-3 font-semibold">Date</th>
            <th className="w-8 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {payments.map((p) => (
            <tr
              key={p.invoice_id}
              onClick={() => onSelect(p)}
              className="group cursor-pointer text-[13.5px] transition hover:bg-slate-50/80"
            >
              <td className="px-5 py-3">
                <p className="max-w-52 truncate font-semibold text-slate-900">{p.full_name}</p>
                <p className="max-w-52 truncate font-mono text-[11.5px] text-slate-400">{p.invoice_id}</p>
              </td>
              <td className="px-3 py-3">
                {p.payment_method ? (
                  <div className="flex items-center gap-2">
                    <ProviderMark provider={p.payment_method} size="xs" />
                    <div>
                      <p className="font-medium text-slate-700">{PROVIDERS[p.payment_method]?.name}</p>
                      {p.sender_number && <p className="text-[11.5px] text-slate-400">{p.sender_number}</p>}
                    </div>
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              {!compact && (
                <td className="px-3 py-3 font-mono text-[12.5px] text-slate-600">{p.transaction_id || <span className="text-slate-300">—</span>}</td>
              )}
              <td className="px-3 py-3 text-right">
                <p className="font-semibold tabular-nums text-slate-900">{money(p.amount)}</p>
                {p.paid_amount != null && p.paid_amount !== p.amount && (
                  <p className={cn('text-[11.5px] tabular-nums', p.paid_amount < p.amount ? 'text-red-500' : 'text-emerald-600')}>
                    paid {money(p.paid_amount)}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-[12.5px] text-slate-500">{dateTime(p.created_at)}</td>
              <td className="px-3 py-3">
                <ChevronRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
