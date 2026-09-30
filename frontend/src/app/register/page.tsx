'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/auth/auth-shell';
import { SlugField, type SlugState } from '@/components/auth/slug-field';
import { Input, PasswordInput, PasswordRules, passwordValid } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';
import type { Session } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const { session, mutate } = useSession();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [slug, setSlug] = useState<SlugState>({ value: '', available: null, checking: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) router.replace(homeFor(session));
  }, [session, router]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.email &&
    passwordValid(form.password) &&
    !slug.checking &&
    // If the live check itself failed, still let the server decide (it re-checks the URL).
    (slug.available === true || (slug.failed === true && slug.value.trim().length >= 3));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErrors({});
    setLoading(true);
    try {
      const res = await api.post<Session & { status: boolean }>('/api/auth/register', {
        ...form,
        slug: slug.value,
      });
      await mutate(res);
      toast.success('Your PalkiPay account is ready!');
      router.replace(homeFor(res));
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Registration failed');
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start accepting automated mobile-banking payments in minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Input label="Full name or business name" autoComplete="name" placeholder="Rahim Traders" value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Email address" type="email" autoComplete="email" placeholder="you@business.com" value={form.email} onChange={set('email')} error={errors.email} />
          <Input label="Mobile number" optional type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set('phone')} error={errors.phone} />
        </div>
        <SlugField value={slug.value} onChange={setSlug} error={errors.slug} />
        <div>
          <PasswordInput label="Password" autoComplete="new-password" placeholder="Create a strong password" value={form.password} onChange={set('password')} error={errors.password} />
          <PasswordRules value={form.password} />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!canSubmit}>
          Create account <ArrowRight className="size-4" />
        </Button>
        <p className="text-center text-xs text-slate-400">
          By creating an account you agree to use PalkiPay only for lawful payments you are entitled to receive.
        </p>
      </form>
    </AuthShell>
  );
}
