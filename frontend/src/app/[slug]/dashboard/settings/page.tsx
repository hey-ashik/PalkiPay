'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Building2, ImagePlus, Lock, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, PasswordInput, PasswordRules, passwordValid } from '@/components/ui/field';
import { CopyButton, Skeleton } from '@/components/ui/misc';
import { useDashboard } from '@/components/dashboard/context';
import { api, ApiError, fetcher } from '@/lib/api';

interface Brand {
  brand_name: string;
  brand_logo: string | null;
  support_phone: string | null;
  support_email: string | null;
  default_webhook_url: string | null;
}

function BrandForm() {
  const { refreshSession } = useDashboard();
  const { data, mutate } = useSWR<{ data: Brand }>('/api/merchant/settings/brand', fetcher);
  const [form, setForm] = useState<Brand | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data && !form) setForm(data.data);
  }, [data, form]);

  if (!form) return <Skeleton className="h-96 rounded-2xl" />;
  const set = (key: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) return toast.error('Use a PNG, JPG, WebP or SVG image');
    if (file.size > 280 * 1024) return toast.error('Logo must be smaller than 280 KB');
    const reader = new FileReader();
    reader.onload = () => setForm((f) => (f ? { ...f, brand_logo: String(reader.result) } : f));
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setErrors({});
    try {
      const res = await api.put<{ message: string }>('/api/merchant/settings/brand', form);
      toast.success(res.message);
      mutate();
      refreshSession();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<Building2 className="size-4" />} title="Business & checkout branding" description="Shown to customers on your checkout and public page." />
      <form onSubmit={save} className="space-y-5 px-5 py-5">
        <div className="flex items-center gap-4">
          <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
            {form.brand_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.brand_logo} alt="Logo" className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-6" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              Upload logo
            </Button>
            {form.brand_logo && (
              <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, brand_logo: null })}>
                <X className="size-3.5" /> Remove
              </Button>
            )}
            <p className="w-full text-[12px] text-slate-500">Square PNG/JPG/SVG, up to 280 KB.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
        </div>
        <Input label="Business name" value={form.brand_name} onChange={set('brand_name')} error={errors.brand_name} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Support phone" optional value={form.support_phone || ''} onChange={set('support_phone')} error={errors.support_phone} placeholder="01XXXXXXXXX" />
          <Input label="Support email" optional type="email" value={form.support_email || ''} onChange={set('support_email')} error={errors.support_email} placeholder="help@yourshop.com" />
        </div>
        <Input
          label="Default webhook URL"
          optional
          type="url"
          value={form.default_webhook_url || ''}
          onChange={set('default_webhook_url')}
          error={errors.default_webhook_url}
          placeholder="https://yourshop.com/api/palkipay-webhook"
          hint="Used when a payment is created without its own webhook_url (e.g. payment links)."
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save branding
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm() {
  const { session, refreshSession, origin } = useDashboard();
  const [name, setName] = useState(session.user.name);
  const [phone, setPhone] = useState(session.user.phone || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await api.put<{ message: string }>('/api/auth/profile', { name, phone });
      toast.success(res.message);
      refreshSession();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const url = `${origin}/${session.user.slug}`;
  return (
    <Card>
      <CardHeader icon={<UserRound className="size-4" />} title="Profile" />
      <form onSubmit={save} className="space-y-5 px-5 py-5">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-700">PalkiPay URL</p>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800">{url}</code>
            <CopyButton value={url} label="URL copied" />
          </div>
          <p className="mt-1.5 text-[12.5px] text-slate-500">Your URL is permanent — it’s used by your integrations and customers.</p>
        </div>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Email" value={session.user.email} disabled hint="Contact support to change your email." />
          <Input label="Mobile number" optional value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} placeholder="01XXXXXXXXX" />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save profile
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const res = await api.put<{ message: string }>('/api/auth/password', { current_password: current, new_password: next });
      toast.success(res.message);
      setCurrent('');
      setNext('');
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader icon={<Lock className="size-4" />} title="Password" description="Also used to sign in to the Android forwarding app." />
      <form onSubmit={save} className="space-y-5 px-5 py-5">
        <PasswordInput label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current_password} />
        <div>
          <PasswordInput label="New password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.new_password} />
          <PasswordRules value={next} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!current || !passwordValid(next)}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your business profile, checkout branding and account security." />
      <div className="grid gap-4 xl:grid-cols-2">
        <BrandForm />
        <div className="space-y-4">
          <ProfileForm />
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
