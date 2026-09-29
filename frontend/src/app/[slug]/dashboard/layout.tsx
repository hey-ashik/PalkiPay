'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardContext } from '@/components/dashboard/context';
import { DashboardShell } from '@/components/dashboard/shell';
import { LogoMark } from '@/components/brand/logo';
import { useSession } from '@/lib/session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { session, unauthenticated, error, mutate } = useSession();
  const [origin, setOrigin] = useState('');

  useEffect(() => setOrigin(window.location.origin), []);

  const slug = session?.user.slug || '';
  const mismatch = Boolean(session && session.user.slug !== params.slug.toLowerCase());

  useEffect(() => {
    if (unauthenticated) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    } else if (session && !session.user.slug) {
      router.replace('/onboarding');
    } else if (mismatch) {
      // Signed in, but looking at someone else's slug → go to your own dashboard.
      router.replace(`/${session!.user.slug}/dashboard`);
    }
  }, [session, unauthenticated, mismatch, router]);

  const value = useMemo(
    () =>
      session && slug
        ? { session, slug, base: `/${slug}/dashboard`, origin, refreshSession: () => mutate() }
        : null,
    [session, slug, origin, mutate]
  );

  if (!value || mismatch || !origin) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <LogoMark className="size-12 animate-pulse" />
          {error && !unauthenticated && <p className="text-sm text-red-600">{error.message}</p>}
        </div>
      </div>
    );
  }

  return (
    <DashboardContext.Provider value={value}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardContext.Provider>
  );
}
