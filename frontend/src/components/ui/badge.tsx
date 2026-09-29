import { CheckCircle2, Clock3, XCircle, CircleDashed, Ban, TimerOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/format';
import type { PaymentStatus } from '@/lib/types';

type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'violet';

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
};

export function Badge({ tone = 'slate', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<PaymentStatus, { tone: Tone; label: string; icon: React.ElementType }> = {
  completed: { tone: 'green', label: 'Completed', icon: CheckCircle2 },
  processing: { tone: 'blue', label: 'Verifying', icon: Loader2 },
  pending: { tone: 'amber', label: 'Needs review', icon: Clock3 },
  failed: { tone: 'red', label: 'Failed', icon: XCircle },
  unpaid: { tone: 'slate', label: 'Unpaid', icon: CircleDashed },
  cancelled: { tone: 'slate', label: 'Cancelled', icon: Ban },
  expired: { tone: 'slate', label: 'Expired', icon: TimerOff },
};

/** Status is always shown with an icon + label, never colour alone. */
export function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS[status] || STATUS.unpaid;
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      <Icon className={cn('size-3', status === 'processing' && 'animate-spin')} />
      {s.label}
    </Badge>
  );
}
