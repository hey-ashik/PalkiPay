'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Apple, Eye, EyeOff, KeyRound, MoreHorizontal, Plus, RefreshCw, Smartphone, Trash2, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CopyButton, EmptyState, Segmented, Skeleton, Switch } from '@/components/ui/misc';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { useDashboard } from '@/components/dashboard/context';
import { api, ApiError, fetcher } from '@/lib/api';
import { timeAgo, cn } from '@/lib/format';
import type { Device } from '@/lib/types';

interface DevicesResponse {
  data: Device[];
  endpoints: { base_url: string; sms_url: string; login_url: string };
}

const mask = (key: string) => `${key.slice(0, 8)}${'•'.repeat(16)}${key.slice(-4)}`;

function CodeLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-slate-800">{value}</code>
        <CopyButton value={value} label={`${label} copied`} />
      </div>
    </div>
  );
}

function DeviceRow({ device, onChange }: { device: Device; onChange: () => void }) {
  const [reveal, setReveal] = useState(false);
  const [menu, setMenu] = useState(false);

  async function toggle(value: boolean) {
    try {
      await api.patch(`/api/merchant/devices/${device.id}`, { is_active: value });
      toast.success(value ? 'Device enabled' : 'Device paused — its SMS will be rejected');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function regenerate() {
    setMenu(false);
    if (!confirm('Generate a new key? The phone will stop forwarding until you update the key on it.')) return;
    try {
      const res = await api.post<{ message: string }>(`/api/merchant/devices/${device.id}/regenerate`);
      toast.success(res.message);
      onChange();
      setReveal(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }
  async function remove() {
    setMenu(false);
    if (!confirm(`Remove “${device.name}”? It will no longer be able to forward SMS.`)) return;
    try {
      await api.del(`/api/merchant/devices/${device.id}`);
      toast.success('Device removed');
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  }

  const Icon = device.platform === 'ios' ? Apple : Smartphone;
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="size-5" />
          <span className={cn('absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-white', device.online ? 'bg-emerald-500' : 'bg-slate-300')} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14.5px] font-semibold text-slate-900">{device.name}</p>
            <Badge tone={device.online ? 'green' : 'slate'}>{device.online ? 'Online' : 'Offline'}</Badge>
            {!device.is_active && <Badge tone="amber">Paused</Badge>}
          </div>
          <p className="text-[12.5px] text-slate-500">
            {device.platform === 'ios' ? 'iPhone (Shortcut)' : device.platform === 'android' ? 'Android' : 'Other'} · last seen {timeAgo(device.last_seen_at)} · {device.sms_count ?? 0} SMS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={device.is_active} onChange={toggle} label="Device active" />
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setMenu((m) => !m)} aria-label="More">
              <MoreHorizontal className="size-4" />
            </Button>
            {menu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift">
                <button onClick={regenerate} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                  <RefreshCw className="size-4 text-slate-400" /> Regenerate key
                </button>
                <button onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50">
                  <Trash2 className="size-4" /> Remove device
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5 sm:ml-15">
        <KeyRound className="size-3.5 shrink-0 text-slate-400" />
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-slate-700">{reveal ? device.device_key : mask(device.device_key)}</code>
        <button onClick={() => setReveal((r) => !r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={reveal ? 'Hide key' : 'Show key'}>
          {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <CopyButton value={device.device_key} label="Device key copied" />
      </div>
    </li>
  );
}

/** Copyable token used inside the iPhone steps. */
function Chip({ value, label }: { value: string; label?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-slate-100 py-0.5 pl-2 pr-0.5 align-middle">
      <code className="truncate font-mono text-[12px] text-slate-800">{value}</code>
      <CopyButton value={value} label={`${label || value} copied`} className="p-1" />
    </span>
  );
}

function IosStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <div className="mt-1 space-y-1.5 text-slate-600">{children}</div>
      </div>
    </li>
  );
}

/**
 * iPhone (iOS 17/18) Shortcuts automation. The phone forwards the raw SMS;
 * PalkiPay extracts amount, sender number, TrxID and time on the server and
 * returns a one-line `summary` the shortcut can show as a notification.
 */
function IosGuide({ smsUrl, deviceKey }: { smsUrl: string; deviceKey?: string }) {
  return (
    <div className="mt-6 space-y-5 text-[13.5px] leading-relaxed">
      <p className="rounded-xl bg-brand-50/70 px-4 py-3 text-[13px] text-brand-900">
        The iPhone only forwards the SMS. PalkiPay reads the <b>amount, sender number, TrxID and time</b> itself (bKash, Nagad, Rocket &amp; Upay), so the
        shortcut stays simple and keeps working if a wallet changes its SMS wording.
      </p>
      <ol className="space-y-4">
        <IosStep n={1} title="Get a device key">
          <p>
            Click <b>Add device</b> above, choose <b>iPhone</b>, and keep the key handy{deviceKey ? ':' : '.'}
          </p>
          {deviceKey && <Chip value={deviceKey} label="Device key" />}
        </IosStep>
        <IosStep n={2} title="Create the automation">
          <p>
            <b>Shortcuts</b> app → <b>Automation</b> tab → <b>+</b> → <b>Message</b>.
          </p>
          <p>
            Tap <b>Message Contains</b> and type <Chip value="TrxID" /> (bKash &amp; Upay). Choose <b>Run Immediately</b> and turn off <b>Notify When Run</b> →{' '}
            <b>Next</b> → <b>New Blank Automation</b>.
          </p>
        </IosStep>
        <IosStep n={3} title="Send the SMS to PalkiPay">
          <p>
            Add the action <b>Get Contents of URL</b> and paste the URL:
          </p>
          <Chip value={smsUrl} label="SMS endpoint" />
          <p>
            Tap <b>›</b> to expand it and set <b>Method</b> to <b>POST</b>.
          </p>
          <p>
            <b>Headers</b> → Add new header: key <Chip value="X-Device-Key" />, value = your device key.
          </p>
          <p>
            <b>Request Body</b> → <b>JSON</b>, then add three <b>Text</b> fields:
          </p>
          <ul className="space-y-1.5 pl-1">
            <li>
              <Chip value="message" /> → tap the value, choose variable <b>Shortcut Input</b>, then tap it again and pick <b>Content</b>
            </li>
            <li>
              <Chip value="sender" /> → <b>Shortcut Input</b> → <b>Sender</b>
            </li>
            <li>
              <Chip value="received_at" /> → variable <b>Current Date</b>, tap it and set <b>Date Format</b> to <b>ISO 8601</b>
            </li>
          </ul>
        </IosStep>
        <IosStep n={4} title="Show what PalkiPay read (optional)">
          <p>
            Add <b>Get Dictionary Value</b>: get <b>Value</b> for key <Chip value="summary" /> in <b>Contents of URL</b>. Then add <b>Show Notification</b>{' '}
            with <b>Dictionary Value</b>. You’ll see e.g. <i>“✅ bKash ৳500.00 from 01712345678 · TrxID BK12AB34CD · 4:30 pm”</i>.
          </p>
        </IosStep>
        <IosStep n={5} title="Repeat for Nagad & Rocket">
          <p>
            Long-press the automation → <b>Duplicate</b>, and change <b>Message Contains</b> to <Chip value="TxnID" /> (Nagad &amp; Rocket).
          </p>
        </IosStep>
        <IosStep n={6} title="Test it">
          <p>
            Send yourself ৳1 from another wallet, or send yourself a copy of an old wallet SMS. It appears in <b>SMS inbox</b> within seconds, and the device shows
            as <b>Online</b> here.
          </p>
        </IosStep>
      </ol>
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-[12.5px] text-slate-500">
        Keep the iPhone online (Wi-Fi or mobile data). Automations run when the phone is locked. If nothing arrives, open <b>Shortcuts → Automation</b> and check the
        automation is enabled, and make sure the SIM that receives wallet SMS is in this iPhone.
      </p>
    </div>
  );
}

function SetupGuide({ endpoints, firstKey }: { endpoints: DevicesResponse['endpoints']; firstKey?: string }) {
  const [tab, setTab] = useState<'ios' | 'android' | 'curl'>('ios');
  const key = firstKey || 'YOUR_DEVICE_KEY';
  const curl = `curl -X POST "${endpoints.sms_url}" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Key: ${key}" \\
  -d '{"sender":"bKash","message":"You have received Tk 500.00 from 01712345678. Fee Tk 0.00. Balance Tk 1,500.00. TrxID TEST123ABC at 29/09/2026 16:30"}'`;

  return (
    <Card>
      <CardHeader title="Connect a phone" description="Forward wallet SMS from the phone that holds your bKash / Nagad / Rocket / Upay SIM." />
      <div className="px-5 py-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ios', label: 'iPhone' },
            { value: 'android', label: 'Android' },
            { value: 'curl', label: 'Test with cURL' },
          ]}
        />
        <div className="mt-5 space-y-4">
          <CodeLine label="Base URL" value={endpoints.base_url} />
          <CodeLine label="SMS endpoint" value={endpoints.sms_url} />
        </div>

        {tab === 'ios' && <IosGuide smsUrl={endpoints.sms_url} deviceKey={firstKey} />}

        {tab === 'android' && (
          <div className="mt-6 space-y-3 text-[13.5px] leading-relaxed text-slate-600">
            <p>
              The <b>PalkiPay Android app</b> signs in with your dashboard email and password, asks for SMS and notification permission, and forwards
              wallet messages automatically. It shows <b>Pending</b>, <b>Stored</b> and <b>Failed</b> messages on its dashboard.
            </p>
            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
              <p className="font-semibold text-brand-800">App release coming soon</p>
              <p className="mt-1 text-[13px] text-brand-700">
                The server side is ready: the app signs in at <code className="font-mono">{endpoints.login_url}</code> and posts to the SMS endpoint. Until the app is released,
                any SMS-forwarder app that can send an HTTP POST with the header <code className="font-mono">X-Device-Key</code> works — use an Android device key from above.
              </p>
            </div>
          </div>
        )}

        {tab === 'curl' && (
          <div className="mt-6">
            <p className="mb-2 text-[13px] text-slate-600">Send a sample bKash SMS from your terminal to check the connection:</p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl bg-navy-950 p-4 font-mono text-[12px] leading-relaxed text-slate-200">{curl}</pre>
              <span className="absolute right-2 top-2">
                <CopyButton value={curl} label="Command copied" className="bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white" />
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function DevicesPage() {
  const { refreshSession } = useDashboard();
  const { data, mutate } = useSWR<DevicesResponse>('/api/merchant/devices', fetcher, { refreshInterval: 30_000 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'ios' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/merchant/devices', form);
      toast.success('Device added — copy its key to the phone');
      setOpen(false);
      setForm({ name: '', platform: 'ios' });
      mutate();
      refreshSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.name || err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Devices"
        description="Phones that forward wallet SMS to PalkiPay. Each device has its own secret key."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add device
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="h-fit">
          <CardHeader title="Your devices" description="Online = seen in the last 15 minutes" />
          {!data ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : data.data.length ? (
            <ul className="divide-y divide-slate-100">
              {data.data.map((d) => (
                <DeviceRow key={d.id} device={d} onChange={() => mutate()} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Smartphone className="size-5" />}
              title="No devices yet"
              description="Add the phone that receives your wallet SMS to start verifying payments automatically."
              action={
                <Button onClick={() => setOpen(true)}>
                  <Plus className="size-4" /> Add device
                </Button>
              }
            />
          )}
        </Card>
        {data && <SetupGuide endpoints={data.endpoints} firstKey={data.data[0]?.device_key} />}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a device" description="You'll get a secret key to paste into the phone.">
        <form onSubmit={add} className="space-y-4">
          <Input label="Device name" placeholder="e.g. Office iPhone — bKash SIM" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={error} autoFocus />
          <Select label="Platform" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="ios">iPhone (Shortcuts automation)</option>
            <option value="android">Android</option>
            <option value="other">Other / custom forwarder</option>
          </Select>
          <Button type="submit" className="w-full" size="lg" loading={saving} disabled={!form.name.trim()}>
            <Terminal className="size-4" /> Create device key
          </Button>
        </form>
      </Modal>
    </>
  );
}
