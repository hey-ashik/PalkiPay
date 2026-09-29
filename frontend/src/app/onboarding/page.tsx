'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { SlugField, type SlugState } from '@/components/auth/slug-field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Session } from '@/lib/types';

/** For accounts that have not claimed their URL yet. */
export default function OnboardingPage() {
  const router = useRouter();
  const { session, unauthenticated, mutate } = useSession();
  const [slug, setSlug] = useState<SlugState>({ value: '', available: null, checking: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unauthenticated) router.replace('/login?next=/onboarding');
    else if (session?.user.slug) router.replace(`/${session.user.slug}/dashboard`);
  }, [session, unauthenticated, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<Session & { status: boolean }>('/api/auth/slug', { slug: slug.value });
      await mutate(res);
      toast.success('Your PalkiPay URL is live!');
      router.replace(`/${res.user.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.slug || err.message : 'Could not save your URL');
      setLoading(false);
    }
  }

  if (!session || session.user.slug) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-6 text-brand-600" />
      </div>
    );
  }

  return (
    <AuthShell title="Claim your PalkiPay URL" subtitle={<>Hi {session.user.name.split(' ')[0]}, pick the address your customers will pay you at.</>}>
      <form onSubmit={onSubmit} className="space-y-5">
        <SlugField value={slug.value} onChange={setSlug} error={error} autoFocus />
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={slug.available !== true || slug.checking}>
          Continue to dashboard <ArrowRight className="size-4" />
        </Button>
      </form>
    </AuthShell>
  );
}
