import Link from 'next/link';
import { cn } from '@/lib/format';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="pp-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#009dfa" />
          <stop offset="1" stopColor="#006cfa" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#pp-logo-g)" />
      <path
        d="M22 48V16h12.5a10 10 0 0 1 0 20H22"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="42.5" cy="45.5" r="4.5" fill="#fff" />
    </svg>
  );
}

export function Logo({
  href = '/',
  className,
  light = false,
}: {
  href?: string | null;
  className?: string;
  light?: boolean;
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-[19px] font-bold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
        Palki<span className={light ? 'text-brand-300' : 'text-brand-600'}>Pay</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} aria-label="PalkiPay home">
      {content}
    </Link>
  ) : (
    content
  );
}
