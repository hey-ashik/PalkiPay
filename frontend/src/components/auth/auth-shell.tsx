import { Check, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ProviderMark } from '@/components/brand/provider-mark';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,560px)] xl:grid-cols-[1fr_minmax(0,620px)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-[14.5px] text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>}
        </div>
        <p className="text-center text-xs text-slate-400">
          <ShieldCheck className="mr-1 inline size-3.5 align-[-2px]" />
          Protected with encrypted sessions and rate limiting
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-navy-900 lg:block">
        <div className="absolute inset-0 bg-brand-gradient-v opacity-90" />
        <div className="absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex gap-2">
            <ProviderMark provider="bkash" size="sm" />
            <ProviderMark provider="nagad" size="sm" />
            <ProviderMark provider="rocket" size="sm" />
            <ProviderMark provider="upay" size="sm" />
          </div>
          <div>
            <h2 className="max-w-md text-[34px] font-bold leading-tight tracking-tight">
              Payments that confirm themselves.
            </h2>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-white/80">
              Your wallet SMS becomes proof of payment. PalkiPay checks every Transaction ID and amount, then tells your
              store — and you on Telegram — in seconds.
            </p>
            <ul className="mt-8 space-y-3">
              {['Automatic bKash, Nagad, Rocket & Upay verification', 'Your own URL: palkipay.ashiik.com/yourshop', 'Approve or reject payments from Telegram'].map((t) => (
                <li key={t} className="flex items-center gap-3 text-[14.5px] text-white/90">
                  <span className="grid size-5 place-items-center rounded-full bg-white/20">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/75">Today’s revenue</span>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">+18 payments</span>
            </div>
            <p className="mt-1 text-3xl font-bold">৳48,250.00</p>
            <div className="mt-4 flex h-12 items-end gap-1.5">
              {[30, 45, 38, 60, 52, 70, 64, 82, 76, 95].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[4px] bg-white/70" style={{ height: `${h}%`, opacity: 0.35 + i * 0.065 }} />
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
