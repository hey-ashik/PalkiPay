import { PROVIDERS } from '@/lib/providers';
import type { ProviderId } from '@/lib/types';
import { cn } from '@/lib/format';

/**
 * Wallet badge in the provider's colours. We render our own wordmark rather
 * than the official logos (which are trademarks of their owners).
 */
export function ProviderMark({
  provider,
  size = 'md',
  className,
}: {
  provider: ProviderId | string | null | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const p = provider ? PROVIDERS[provider as ProviderId] : undefined;
  const dims = {
    xs: 'size-6 rounded-md text-[9px]',
    sm: 'size-8 rounded-lg text-[10px]',
    md: 'size-10 rounded-xl text-[11px]',
    lg: 'size-14 rounded-2xl text-[14px]',
  }[size];
  if (!p) {
    return <span className={cn('grid shrink-0 place-items-center bg-slate-100 font-bold text-slate-400', dims, className)}>—</span>;
  }
  const short = { bkash: 'bK', nagad: 'N', rocket: 'R', upay: 'U' }[p.id];
  return (
    <span
      className={cn('grid shrink-0 place-items-center font-extrabold tracking-tight shadow-sm', dims, className)}
      style={{ background: p.gradient, color: p.onColor }}
      title={p.name}
    >
      {short}
    </span>
  );
}

export function ProviderName({ provider }: { provider: ProviderId | string | null | undefined }) {
  const p = provider ? PROVIDERS[provider as ProviderId] : undefined;
  return <>{p?.name || '—'}</>;
}

/** Large wordmark tile used on the landing page and checkout method picker. */
export function ProviderWordmark({ provider, className }: { provider: ProviderId; className?: string }) {
  const p = PROVIDERS[provider];
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-xl px-3 py-1.5 text-[15px] font-extrabold tracking-tight', className)}
      style={{ background: p.gradient, color: p.onColor }}
    >
      {p.name}
    </span>
  );
}
