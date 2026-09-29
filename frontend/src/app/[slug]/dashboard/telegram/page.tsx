'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Bot, CheckCircle2, ExternalLink, Send, Unplug, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, PasswordInput } from '@/components/ui/field';
import { Skeleton, Switch } from '@/components/ui/misc';
import { useDashboard } from '@/components/dashboard/context';
import { api, ApiError, fetcher } from '@/lib/api';
import { cn } from '@/lib/format';

interface TelegramState {
  connected: boolean;
  enabled: boolean;
  bot_username: string | null;
  chat_id: string | null;
  chat_linked: boolean;
  link_url: string | null;
  mode: 'webhook' | 'polling';
}

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="group relative flex gap-4 pb-8 last:pb-0">
      <span
        className={cn(
          'relative z-10 grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-bold',
          done ? 'bg-emerald-500 text-white' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
        )}
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <span className="absolute left-4 top-8 h-full w-px -translate-x-1/2 bg-slate-200 group-last:hidden" />
      <div className="min-w-0 flex-1 pt-1">
        <h3 className="text-[14.5px] font-semibold text-slate-900">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </li>
  );
}

export default function TelegramPage() {
  const { refreshSession } = useDashboard();
  const { data, mutate } = useSWR<{ data: TelegramState }>('/api/merchant/telegram', fetcher, {
    // While waiting for the user to press Start in Telegram, poll for the link.
    refreshInterval: (latest) => (latest?.data.connected && !latest.data.chat_linked ? 3000 : 0),
  });
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const t = data?.data;

  async function save(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await api.put<{ message: string; data: TelegramState }>('/api/merchant/telegram', body);
      toast.success(res.message);
      setToken('');
      await mutate({ data: res.data }, { revalidate: false });
      refreshSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.bot_token || err.errors?.chat_id || err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    try {
      const res = await api.post<{ message: string }>('/api/merchant/telegram/test');
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect Telegram? You will stop receiving payment notifications.')) return;
    setBusy('disconnect');
    try {
      await api.del('/api/merchant/telegram');
      toast.success('Telegram disconnected');
      mutate();
      refreshSession();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Telegram bot"
        description="Get every payment on Telegram and approve or reject payments that need review with one tap."
        action={
          t?.connected && (
            <Button variant="danger" onClick={disconnect} loading={busy === 'disconnect'}>
              <Unplug className="size-4" /> Disconnect
            </Button>
          )
        }
      />
      {!t ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader
              icon={<Bot className="size-4" />}
              title="Setup"
              action={t.chat_linked ? <Badge tone="green">Connected</Badge> : t.connected ? <Badge tone="amber">Waiting for chat</Badge> : <Badge>Not connected</Badge>}
            />
            <ol className="px-5 py-6">
              <Step n={1} done={t.connected} title="Create your bot">
                {t.connected ? (
                  <p className="text-[13.5px] text-slate-600">
                    Bot <b>@{t.bot_username}</b> is connected.{' '}
                    <button className="font-semibold text-brand-600 hover:text-brand-700" onClick={() => mutate({ data: { ...t, connected: false } }, { revalidate: false })}>
                      Use a different bot
                    </button>
                  </p>
                ) : (
                  <>
                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                      Open{' '}
                      <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-semibold text-brand-600">
                        @BotFather
                      </a>{' '}
                      in Telegram, send <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">/newbot</code>, follow the prompts and paste the token it gives you.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                      <PasswordInput
                        className="flex-1"
                        placeholder="123456789:AAH…"
                        value={token}
                        onChange={(e) => setToken(e.target.value.trim())}
                        error={error}
                        autoComplete="off"
                      />
                      <Button onClick={() => save({ bot_token: token }, 'token')} loading={busy === 'token'} disabled={!token} className="h-11">
                        Connect bot
                      </Button>
                    </div>
                  </>
                )}
              </Step>
              <Step n={2} done={t.chat_linked} title="Link your chat">
                {!t.connected ? (
                  <p className="text-[13.5px] text-slate-400">Connect a bot first.</p>
                ) : t.chat_linked ? (
                  <p className="text-[13.5px] text-slate-600">
                    Notifications go to chat <code className="font-mono text-[12.5px]">{t.chat_id}</code>.
                  </p>
                ) : (
                  <>
                    <p className="text-[13.5px] leading-relaxed text-slate-600">
                      Open your bot and press <b>Start</b>. This page updates automatically once the chat is linked.
                    </p>
                    {t.link_url && (
                      <a href={t.link_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-[#229ED9] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-105">
                        <Send className="size-4" /> Open @{t.bot_username}
                        <ExternalLink className="size-3.5 opacity-70" />
                      </a>
                    )}
                    <details className="mt-4 text-[13px] text-slate-500">
                      <summary className="cursor-pointer font-medium text-slate-600">Use a group or channel instead</summary>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                        <Input className="flex-1" placeholder="-1001234567890" value={chatId} onChange={(e) => setChatId(e.target.value)} />
                        <Button variant="secondary" className="h-11" onClick={() => save({ chat_id: chatId }, 'chat')} loading={busy === 'chat'} disabled={!chatId}>
                          Save chat ID
                        </Button>
                      </div>
                      <p className="mt-1.5">Add the bot to the group as an admin, then enter the group’s chat ID.</p>
                    </details>
                  </>
                )}
              </Step>
              <Step n={3} done={false} title="Send a test notification">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="secondary" onClick={test} loading={busy === 'test'} disabled={!t.chat_linked}>
                    <BellRing className="size-4" /> Send test message
                  </Button>
                  {t.chat_linked && (
                    <label className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-700">
                      <Switch checked={t.enabled} onChange={(v) => save({ enabled: v }, 'enabled')} label="Notifications enabled" />
                      Notifications {t.enabled ? 'on' : 'off'}
                    </label>
                  )}
                </div>
              </Step>
            </ol>
          </Card>

          <Card className="h-fit p-5">
            <p className="text-[13px] font-semibold text-slate-500">What you’ll receive</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl rounded-tl-md bg-[#EFFDDE] p-3.5 text-[13px] leading-relaxed text-slate-800 shadow-sm">
                ✅ <b>Payment received</b>
                <br />
                🧾 Invoice: <span className="font-mono">Xk29sQ…</span>
                <br />
                💰 Amount: <b>৳1,250.00</b>
                <br />
                📱 bKash · 01712345678
                <br />
                <i className="text-slate-500">Verified automatically by SMS</i>
              </div>
              <div className="rounded-2xl rounded-tl-md bg-white p-3.5 text-[13px] leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200">
                🟡 <b>Payment needs your review</b>
                <br />
                💰 Amount: <b>৳800.00</b> · Nagad
                <br />
                🔖 TrxID: <span className="font-mono">71ABCD12</span>
                <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                  <span className="rounded-lg bg-slate-100 py-1.5 text-center text-[12.5px] font-semibold text-slate-700">✅ Approve</span>
                  <span className="rounded-lg bg-slate-100 py-1.5 text-center text-[12.5px] font-semibold text-slate-700">❌ Reject</span>
                </div>
              </div>
            </div>
            {t.mode === 'polling' && (
              <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] text-slate-500">
                Running in local mode: the server polls Telegram for button presses. In production (HTTPS) it switches to webhooks automatically.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
