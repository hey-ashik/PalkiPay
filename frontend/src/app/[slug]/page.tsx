'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Headphones, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ProviderMark } from '@/components/brand/provider-mark';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { PROVIDERS } from '@/lib/providers';
import type { ProviderId } from '@/lib/types';

interface MerchantPublic {
  merchant: { slug: string; brand_name: string; logo: string | null; support_phone: string | null; support_email: string | null };
  providers: ProviderId[];
}

/** palkipay.ashiik.com/<slug> — the merchant's public gateway page. */
export default function MerchantPage() {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useSession();
  const [data, setData] = useState<MerchantPublic | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api
      .get<MerchantPublic>(`/api/merchants/${encodeURIComponent(slug)}`)
      .then(setData)
      .catch(() => setMissing(true));
  }, [slug]);

  const isOwner = session?.user.slug === slug.toLowerCase();

  return (
    <div className="flex min-h-screen flex-col bg-canvas bg-[radial-gradient(ellipse_at_top,rgb(0_157_250/0.14),transparent_60%)]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        {isOwner ? (
          <ButtonLink href={`/${slug}/dashboard`} size="sm">
            Open dashboard <ArrowRight className="size-3.5" />
          </ButtonLink>
        ) : (
          <ButtonLink href={`/login?next=/${slug}/dashboard`} size="sm" variant="secondary">
            Merchant login
          </ButtonLink>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        {missing ? (
          <div className="max-w-md text-center">
            <p className="text-6xl font-bold text-slate-200">404</p>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">This PalkiPay page doesn’t exist</h1>
            <p className="mt-2 text-slate-500">
              <span className="font-mono">/{slug}</span> isn’t registered yet — it could be yours.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <ButtonLink href="/register">Claim this URL</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Home
              </ButtonLink>
            </div>
          </div>
        ) : !data ? (
          <Spinner className="size-7 text-brand-600" />
        ) : (
          <div className="w-full max-w-md animate-fade-up">
            <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_24px_60px_-24px_rgb(15_23_42/0.25)]">
              <div className="bg-brand-gradient-v px-6 pb-14 pt-8 text-center text-white">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] font-semibold">
                  <ShieldCheck className="size-3.5" /> Verified PalkiPay merchant
                </p>
              </div>
              <div className="-mt-10 px-6 pb-7 text-center">
                {data.merchant.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.merchant.logo} alt="" className="mx-auto size-20 rounded-2xl border-4 border-white object-cover shadow-lg" />
                ) : (
                  <span className="mx-auto grid size-20 place-items-center rounded-2xl border-4 border-white bg-brand-gradient text-3xl font-bold text-white shadow-lg">
                    {data.merchant.brand_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{data.merchant.brand_name}</h1>
                <p className="mt-1 font-mono text-[13px] text-slate-400">{typeof window !== 'undefined' ? window.location.host : ''}/{data.merchant.slug}</p>
                <p className="mx-auto mt-4 max-w-xs text-[14px] leading-relaxed text-slate-500">
                  Payments to {data.merchant.brand_name} are processed securely by PalkiPay. Use the payment link the merchant sent you to pay.
                </p>

                {data.providers.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">Accepted wallets</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-3">
                      {data.providers.map((p) => (
                        <span key={p} className="flex flex-col items-center gap-1.5">
                          <ProviderMark provider={p} size="md" />
                          <span className="text-[12px] font-medium text-slate-600">{PROVIDERS[p]?.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(data.merchant.support_phone || data.merchant.support_email) && (
                  <div className="mt-7 space-y-2 rounded-2xl bg-slate-50 p-4 text-[13.5px]">
                    {data.merchant.support_phone && (
                      <a href={`tel:${data.merchant.support_phone}`} className="flex items-center justify-center gap-2 text-slate-700 hover:text-brand-600">
                        <Headphones className="size-4 text-slate-400" /> {data.merchant.support_phone}
                      </a>
                    )}
                    {data.merchant.support_email && (
                      <a href={`mailto:${data.merchant.support_email}`} className="flex items-center justify-center gap-2 text-slate-700 hover:text-brand-600">
                        <Mail className="size-4 text-slate-400" /> {data.merchant.support_email}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-slate-400">
              <Lock className="size-3" /> Powered by{' '}
              <Link href="/" className="font-semibold text-slate-500 hover:text-brand-600">
                PalkiPay
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
