'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { useSession, homeFor } from '@/lib/session';
import { cn } from '@/lib/format';

const LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#developers', label: 'Developers' },
  { href: '/docs', label: 'API Docs' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { session } = useSession();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-all duration-200',
        scrolled ? 'border-b border-slate-200/70 bg-white/85 backdrop-blur-xl' : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[14px] font-medium text-slate-600 transition hover:text-slate-900">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {session ? (
            <ButtonLink href={homeFor(session)} size="md">
              Go to dashboard <ArrowRight className="size-4" />
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">
                Sign in
              </ButtonLink>
              <ButtonLink href="/register">
                Get started <ArrowRight className="size-4" />
              </ButtonLink>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 text-slate-700 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-5 pt-2 shadow-lg lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-slate-700 hover:bg-slate-50">
              {l.label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {session ? (
              <ButtonLink href={homeFor(session)} className="col-span-2">
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/register">Get started</ButtonLink>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
