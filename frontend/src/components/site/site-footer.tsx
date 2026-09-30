import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/#features', label: 'Features' },
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/register', label: 'Create account' },
      { href: '/login', label: 'Merchant login' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { href: '/docs', label: 'API reference' },
      { href: '/docs#create-payment', label: 'Create payment' },
      { href: '/docs#webhooks', label: 'Webhooks' },
      { href: '/docs#device-api', label: 'SMS forwarding API' },
    ],
  },
  {
    title: 'Wallets',
    links: [
      { href: '/#features', label: 'bKash' },
      { href: '/#features', label: 'Nagad' },
      { href: '/#features', label: 'Rocket' },
      { href: '/#features', label: 'Upay' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-navy-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed">
              Automated mobile-banking payments for Bangladeshi businesses. Accept bKash, Nagad, Rocket and Upay on your
              own personal numbers — verified in seconds.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm transition hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PalkiPay. All rights reserved.</p>
          <p>bKash, Nagad, Rocket and Upay are trademarks of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}
