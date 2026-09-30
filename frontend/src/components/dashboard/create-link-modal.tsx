'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/misc';
import { api, ApiError } from '@/lib/api';

export function CreateLinkModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: () => void }) {
  const [form, setForm] = useState({ amount: '', full_name: '', email: '', description: '', redirect_url: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function close() {
    onClose();
    setTimeout(() => {
      setUrl(null);
      setErrors({});
      setForm({ amount: '', full_name: '', email: '', description: '', redirect_url: '' });
    }, 200);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await api.post<{ payment_url: string }>('/api/merchant/payments', form);
      setUrl(res.payment_url);
      onCreated?.();
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      toast.error(err instanceof Error ? err.message : 'Could not create link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={url ? 'Payment link ready' : 'Create payment link'}
      description={url ? 'Share this link with your customer. It works on any phone.' : 'Collect a payment without any website integration.'}
    >
      {url ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center py-2 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 animate-pop">
              <CheckCircle2 className="size-7" />
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-slate-700">{url}</p>
            <CopyButton value={url} label="Payment link copied">
              Copy
            </CopyButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              <ExternalLink className="size-4" /> Open
            </a>
            <Button onClick={() => setUrl(null)}>Create another</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Amount (৳)" type="number" inputMode="decimal" min="1" step="0.01" placeholder="500" value={form.amount} onChange={set('amount')} error={errors.amount} autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Customer name" optional placeholder="Customer" value={form.full_name} onChange={set('full_name')} error={errors.full_name} />
            <Input label="Customer email" optional type="email" placeholder="name@email.com" value={form.email} onChange={set('email')} error={errors.email} />
          </div>
          <Input label="Description" optional placeholder="Order #1042 — 2× T-shirt" value={form.description} onChange={set('description')} error={errors.description} />
          <Input label="Redirect after payment" optional type="url" placeholder="https://yourshop.com/thank-you" value={form.redirect_url} onChange={set('redirect_url')} error={errors.redirect_url} />
          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!form.amount}>
            Create link
          </Button>
        </form>
      )}
    </Modal>
  );
}
