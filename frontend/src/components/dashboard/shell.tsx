'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeftRight,
  Code2,
  ExternalLink,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  MessageSquareText,
  Send,
  Settings,
  Smartphone,
  Wallet,
  X,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { CopyButton } from '@/components/ui/misc';
import { logout } from '@/lib/session';
import { cn } from '@/lib/format';
import { useDashboard } from './context';

const NAV = [
  {
    group: 'Overview',
    items: [{ href: '', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Payments',
    items: [
      { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/payment-links', label: 'Payment links', icon: Link2 },
      { href: '/sms', label: 'SMS inbox', icon: MessageSquareText },
    ],
  },
  {
    group: 'Setup',
    items: [
      { href: '/payment-methods', label: 'Payment methods', icon: Wallet },
      { href: '/devices', label: 'Devices', icon: Smartphone },
      { href: '/telegram', label: 'Telegram bot', icon: Send },
      { href: '/developers', label: 'API & integration', icon: Code2 },
    ],
  },
  {
    group: 'Account',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { base } = useDashboard();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map((section) => (
        <div key={section.group}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.group}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const full = `${base}${href}`;
              const active = href === '' ? pathname === base : pathname.startsWith(full);
              return (
                <li key={href}>
                  <Link
                    href={full}
                    onClick={onNavigate}
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition',
                      active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon className={cn('size-[18px]', active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { session, origin, slug } = useDashboard();
  return (
    <div className="border-t border-slate-100 p-3">
      <div className="rounded-xl bg-canvas p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your payment URL</p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <p className="truncate font-mono text-[12px] font-medium text-slate-700" title={`${origin}/${slug}`}>
            {origin.replace(/^https?:\/\//, '')}/{slug}
          </p>
          <CopyButton value={`${origin}/${slug}`} label="Payment URL copied" />
        </div>
      </div>
      <p className="mt-3 truncate px-1 text-[12px] text-slate-400">Signed in as {session.user.email}</p>
    </div>
  );
}

function UserMenu() {
  const { session, slug } = useDashboard();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const initials = session.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-100">
        {session.brand.brand_logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.brand.brand_logo} alt="" className="size-8 rounded-lg object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="grid size-8 place-items-center rounded-lg bg-brand-gradient text-[12px] font-bold text-white">{initials}</span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block max-w-40 truncate text-[13px] font-semibold leading-tight text-slate-900">{session.brand.brand_name}</span>
          <span className="block text-[11.5px] leading-tight text-slate-500">/{slug}</span>
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift animate-fade-up">
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="truncate text-[13px] font-semibold text-slate-900">{session.user.name}</p>
            <p className="truncate text-[12px] text-slate-500">{session.user.email}</p>
          </div>
          <Link href={`/${slug}`} target="_blank" className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50">
            <ExternalLink className="size-4 text-slate-400" /> View public page
          </Link>
          <Link href="/docs" target="_blank" className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50">
            <BookOpen className="size-4 text-slate-400" /> API documentation
          </Link>
          <Link href={`/${slug}/dashboard/settings`} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50">
            <Settings className="size-4 text-slate-400" /> Settings
          </Link>
          <button onClick={logout} className="flex w-full items-center gap-2.5 border-t border-slate-100 px-3.5 py-2 text-[13.5px] text-red-600 hover:bg-red-50">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href={null} />
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo href={null} />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <span className="lg:hidden">
              <Logo href={null} />
            </span>
          </div>
          <UserMenu />
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
