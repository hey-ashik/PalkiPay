'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/field';
import { Segmented, Skeleton, Switch } from '@/components/ui/misc';
import { ProviderMark } from '@/components/brand/provider-mark';
import { useDashboard } from '@/components/dashboard/context';
import { api, ApiError, fetcher } from '@/lib/api';
import { PROVIDERS } from '@/lib/providers';
import type { ProviderId } from '@/lib/types';

interface Method {
  provider: ProviderId;
  name: string;
  configured: boolean;
  account_type: 'personal' | 'agent';
  account_number: string;
  is_active: boolean;
}

function MethodCard({ method, onSaved }: { method: Method; onSaved: () => void }) {
  const [type, setType] = useState(method.account_type);
  const [number, setNumber] = useState(method.account_number);
  const [active, setActive] = useState(method.configured ? method.is_active : true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const p = PROVIDERS[method.provider];

  useEffect(() => {
    setType(method.account_type);
    setNumber(method.account_number);
    setActive(method.configured ? method.is_active : true);
  }, [method]);

  const dirty = type !== method.account_type || number !== method.account_number || active !== (method.configured ? method.is_active : true);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ message: string }>(`/api/merchant/payment-methods/${method.provider}`, {
        account_type: type,
        account_number: number,
        is_active: active,
      });
      toast.success(res.message);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.account_number || err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove your ${p.name} number? Customers won't be able to pay with ${p.name}.`)) return;
    try {
      await api.del(`/api/merchant/payment-methods/${method.provider}`);
      toast.success(`${p.name} removed`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove');
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: `linear-gradient(90deg, ${p.tint}, #fff)` }}>
        <div className="flex items-center gap-3">
          <ProviderMark provider={method.provider} size="md" />
          <div>
            <h3 className="text-[15.5px] font-bold text-slate-900">{p.name}</h3>
            <p className="text-[12.5px] text-slate-500">USSD {p.ussd}</p>
          </div>
        </div>
        {method.configured ? (
          method.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Paused</Badge>
        ) : (
          <Badge tone="slate">Not set up</Badge>
        )}
      </div>
      <div className="space-y-4 px-5 py-5">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Account type</p>
          <Segmented
            value={type}
            onChange={setType}
            options={[
              { value: 'personal', label: 'Personal (Send Money)' },
              { value: 'agent', label: 'Agent (Cash Out)' },
            ]}
          />
        </div>
        <Input
          label={`${p.name} number`}
          type="tel"
          inputMode="numeric"
          placeholder="01XXXXXXXXX"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          error={error}
          hint="Customers send money to this number. Its SMS must be forwarded by one of your devices."
        />
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-700">
            <Switch checked={active} onChange={setActive} label={`Show ${p.name} on checkout`} />
            Show on checkout
          </label>
          <div className="flex items-center gap-2">
            {method.configured && (
              <Button variant="ghost" size="sm" onClick={remove} aria-label="Remove">
                <Trash2 className="size-4" />
              </Button>
            )}
            <Button size="sm" onClick={save} loading={saving} disabled={!number || (!dirty && method.configured)}>
              {method.configured ? 'Save changes' : `Enable ${p.name}`}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function PaymentMethodsPage() {
  const { refreshSession } = useDashboard();
  const { data, mutate } = useSWR<{ data: Method[] }>('/api/merchant/payment-methods', fetcher);

  return (
    <>
      <PageHeader
        title="Payment methods"
        description="Add the wallet numbers customers pay to. Only active methods appear on your checkout page."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {!data
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)
          : data.data.map((m) => (
              <MethodCard
                key={m.provider}
                method={m}
                onSaved={() => {
                  mutate();
                  refreshSession();
                }}
              />
            ))}
      </div>
    </>
  );
}
