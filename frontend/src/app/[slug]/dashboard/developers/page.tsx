'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { BookOpen, Eye, EyeOff, KeyRound, RefreshCw, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, PageHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton, Segmented, Skeleton } from '@/components/ui/misc';
import { Modal } from '@/components/ui/modal';
import { useDashboard } from '@/components/dashboard/context';
import { api, fetcher } from '@/lib/api';

interface Integration {
  api_key: string;
  base_url: string;
  endpoints: { create_payment: string; verify_payment: string };
}

type Lang = 'curl' | 'node' | 'php';

function snippets(base: string, key: string): Record<Lang, string> {
  return {
    curl: `# 1. Create a payment
curl -X POST "${base}/api/checkout-v2" \\
  -H "Content-Type: application/json" \\
  -H "PALKIPAY-API-KEY: ${key}" \\
  -d '{
    "full_name": "Rahim Uddin",
    "email": "rahim@example.com",
    "amount": "500",
    "metadata": { "order_id": "1042" },
    "redirect_url": "https://yourshop.com/success",
    "cancel_url": "https://yourshop.com/cart",
    "webhook_url": "https://yourshop.com/api/palkipay-webhook"
  }'
# → { "status": true, "payment_url": "...", "invoice_id": "..." }

# 2. Verify after the customer returns (?invoice_id=...)
curl -X POST "${base}/api/verify-payment" \\
  -H "Content-Type: application/json" \\
  -H "PALKIPAY-API-KEY: ${key}" \\
  -d '{ "invoice_id": "INVOICE_ID" }'
# → { "status": "COMPLETED", "amount": "500.00", "transaction_id": "...", ... }`,

    node: `// Next.js — app/api/checkout/route.ts
const PALKIPAY = "${base}";

export async function POST(req: Request) {
  const order = await req.json();
  const res = await fetch(\`\${PALKIPAY}/api/checkout-v2\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PALKIPAY-API-KEY": process.env.PALKIPAY_API_KEY!,
    },
    body: JSON.stringify({
      full_name: order.name,
      email: order.email,
      amount: order.total,
      metadata: { order_id: order.id },
      redirect_url: \`\${process.env.SITE_URL}/order/success\`,
      cancel_url: \`\${process.env.SITE_URL}/cart\`,
      webhook_url: \`\${process.env.SITE_URL}/api/palkipay-webhook\`,
    }),
  });
  const data = await res.json();
  if (!data.status) return Response.json({ error: data.message }, { status: 400 });
  return Response.json({ url: data.payment_url });
}

// app/order/success/page.tsx — verify before fulfilling
export async function verify(invoiceId: string) {
  const res = await fetch(\`\${PALKIPAY}/api/verify-payment\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PALKIPAY-API-KEY": process.env.PALKIPAY_API_KEY!,
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
    cache: "no-store",
  });
  const payment = await res.json();
  return payment.status === "COMPLETED";
}`,

    php: `<?php
// Create a payment
$ch = curl_init("${base}/api/checkout-v2");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "PALKIPAY-API-KEY: " . getenv("PALKIPAY_API_KEY"),
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "full_name"    => "Rahim Uddin",
    "email"        => "rahim@example.com",
    "amount"       => "500",
    "metadata"     => ["order_id" => "1042"],
    "redirect_url" => "https://yourshop.com/success",
    "cancel_url"   => "https://yourshop.com/cart",
  ]),
]);
$response = json_decode(curl_exec($ch), true);
if ($response["status"]) {
  header("Location: " . $response["payment_url"]);
  exit;
}`,
  };
}

export default function DevelopersPage() {
  const { origin } = useDashboard();
  const { data, mutate } = useSWR<Integration>('/api/merchant/integration', fetcher);
  const [reveal, setReveal] = useState(false);
  const [lang, setLang] = useState<Lang>('node');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  async function regenerate() {
    setRotating(true);
    try {
      const res = await api.post<{ message: string; api_key: string }>('/api/merchant/integration/regenerate-key');
      toast.success(res.message);
      setConfirmOpen(false);
      setReveal(true);
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRotating(false);
    }
  }

  const code = data ? snippets(data.base_url, reveal ? data.api_key : 'YOUR_API_KEY')[lang] : '';

  return (
    <>
      <PageHeader
        title="API & integration"
        description="Connect your website or app. The API is UddoktaPay-compatible — existing plugins work with your base URL and key."
        action={
          <Link href="/docs" target="_blank">
            <Button variant="secondary">
              <BookOpen className="size-4" /> Full API docs
            </Button>
          </Link>
        }
      />

      {!data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader icon={<KeyRound className="size-4" />} title="Credentials" description="Keep your API key secret — use it only on your server." />
              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-700">Base URL</p>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800">{data.base_url}</code>
                    <CopyButton value={data.base_url} label="Base URL copied" />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-slate-700">API key</p>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-1.5">
                    <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-slate-800">
                      {reveal ? data.api_key : `${data.api_key.slice(0, 6)}${'•'.repeat(22)}${data.api_key.slice(-4)}`}
                    </code>
                    <button onClick={() => setReveal((r) => !r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={reveal ? 'Hide key' : 'Show key'}>
                      {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    <CopyButton value={data.api_key} label="API key copied" />
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-slate-500">
                    Send it in the <code className="font-mono">PALKIPAY-API-KEY</code> header (<code className="font-mono">RT-UDDOKTAPAY-API-KEY</code> also works).
                  </p>
                </div>
                <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
                  <RefreshCw className="size-3.5" /> Regenerate key
                </Button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Endpoints" />
              <ul className="divide-y divide-slate-100">
                {[
                  { method: 'POST', label: 'Create payment', url: data.endpoints.create_payment },
                  { method: 'POST', label: 'Verify payment', url: data.endpoints.verify_payment },
                ].map((e) => (
                  <li key={e.label} className="flex items-center gap-3 px-5 py-3">
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700">{e.method}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800">{e.label}</p>
                      <p className="truncate font-mono text-[12px] text-slate-500">{e.url}</p>
                    </div>
                    <CopyButton value={e.url} label="Endpoint copied" />
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                  <Webhook className="size-4" />
                </span>
                <div className="text-[13px] leading-relaxed text-slate-600">
                  <p className="text-[14px] font-semibold text-slate-900">Webhooks</p>
                  When a payment completes, PalkiPay POSTs the payment JSON to the <code className="font-mono">webhook_url</code> you sent (or your default webhook in
                  Settings), with your API key in the <code className="font-mono">PALKIPAY-API-KEY</code> header. Failed deliveries retry up to 4 times. Always confirm with
                  verify-payment before fulfilling an order.
                </div>
              </div>
            </Card>
          </div>

          <Card className="min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <Segmented
                size="sm"
                value={lang}
                onChange={setLang}
                options={[
                  { value: 'node', label: 'Next.js / Node' },
                  { value: 'php', label: 'PHP' },
                  { value: 'curl', label: 'cURL' },
                ]}
              />
              <CopyButton value={code} label="Code copied">
                Copy code
              </CopyButton>
            </div>
            <pre className="max-h-[640px] overflow-auto bg-navy-950 p-5 font-mono text-[12.5px] leading-relaxed text-slate-200">{code}</pre>
            <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
              Checkout pages are hosted at <span className="font-mono">{origin.replace(/^https?:\/\//, '')}/{data.base_url.split('/').pop()}/checkout/…</span>
            </p>
          </Card>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Regenerate API key?"
        description="Your current key stops working immediately. Update it in every store that uses PalkiPay."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={regenerate} loading={rotating}>
              Regenerate
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-slate-600">Only do this if your key was exposed or you are rotating credentials.</p>
      </Modal>
    </>
  );
}
