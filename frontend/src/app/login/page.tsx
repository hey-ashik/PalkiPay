'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { Input, PasswordInput } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';
import type { Session } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { session, mutate } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;

  useEffect(() => {
    if (session) router.replace(safeNext || homeFor(session));
  }, [session, safeNext, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await api.post<Session & { status: boolean }>('/api/auth/login', { email, password, remember });
      await mutate(res);
      toast.success(`Welcome back, ${res.user.name.split(' ')[0]}!`);
      router.replace(safeNext || homeFor(res));
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@business.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
        autoFocus
      />
      <PasswordInput
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
      />
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-slate-600 select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 rounded border-slate-300 accent-brand-600"
          />
          Remember me for 30 days
        </label>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Sign in <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your PalkiPay merchant dashboard."
      footer={
        <>
          New to PalkiPay?{' '}
          <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
