import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';

export const metadata: Metadata = {
  title: 'API documentation',
  description: 'Integrate PalkiPay: create payments, verify them, receive webhooks and forward wallet SMS.',
};

const BASE = 'https://palkipay.ashiik.com/yourshop';

const TOC = [
  { id: 'overview', label: 'Overview' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'create-payment', label: 'Create payment' },
  { id: 'verify-payment', label: 'Verify payment' },
  { id: 'redirects', label: 'Redirects' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'statuses', label: 'Payment statuses' },
  { id: 'device-api', label: 'SMS forwarding API' },
  { id: 'errors', label: 'Errors' },
];

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-4 min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-navy-950">
      {title && <div className="border-b border-white/10 px-4 py-2 text-[12px] font-medium text-slate-400">{title}</div>}
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-slate-200">{children}</pre>
    </div>
  );
}

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="my-4 flex min-w-0 items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-[12px] font-bold text-emerald-700">{method}</span>
      <code className="whitespace-nowrap font-mono text-[13px] text-slate-800">{path}</code>
    </div>
  );
}

function Params({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[560px] text-left text-[13px]">
        <thead className="bg-slate-50 text-[12px] text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Field</th>
            <th className="px-4 py-2.5 font-semibold">Type</th>
            <th className="px-4 py-2.5 font-semibold">Required</th>
            <th className="px-4 py-2.5 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([name, type, req, desc]) => (
            <tr key={name}>
              <td className="px-4 py-2.5 font-mono text-[12.5px] font-semibold text-slate-900">{name}</td>
              <td className="px-4 py-2.5 text-slate-500">{type}</td>
              <td className="px-4 py-2.5">{req === 'yes' ? <span className="font-semibold text-red-600">Yes</span> : <span className="text-slate-400">No</span>}</td>
              <td className="px-4 py-2.5 text-slate-600">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-slate-100 pb-12 pt-2 last:border-0">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>
);

export default function DocsPage() {
  return (
    <>
      <SiteHeader />
      <div className="border-b border-slate-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Developers</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">PalkiPay API reference</h1>
          <p className="mt-3 max-w-2xl text-[16px] text-slate-600">
            Everything you need to accept bKash, Nagad, Rocket and Upay payments from your website or app. The API is compatible with
            UddoktaPay, so existing plugins work by changing the base URL and API key.
          </p>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-slate-400">On this page</p>
            {TOC.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="block rounded-lg px-3 py-1.5 text-[14px] text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                {t.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 space-y-12">
          <Section id="overview" title="Overview">
            <p>
              Every merchant has a <b>base URL</b> made from their unique PalkiPay slug, for example <C>{BASE}</C>. All API endpoints live under{' '}
              <C>{'{base_url}/api'}</C>. You can find your base URL and API key in <b>Dashboard → API &amp; integration</b>.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Your server calls <b>Create payment</b> and receives a <C>payment_url</C>.</li>
              <li>You redirect the customer to that URL. They pay with their wallet and enter the Transaction ID.</li>
              <li>PalkiPay verifies the payment against the wallet SMS forwarded by your phone.</li>
              <li>The customer is sent back to your <C>redirect_url</C> with <C>invoice_id</C>, and your <C>webhook_url</C> is notified.</li>
              <li>Your server calls <b>Verify payment</b> and fulfils the order when the status is <C>COMPLETED</C>.</li>
            </ol>
          </Section>

          <Section id="authentication" title="Authentication">
            <p>
              Send your API key in the <C>PALKIPAY-API-KEY</C> header on every request. For compatibility, <C>RT-UDDOKTAPAY-API-KEY</C>, <C>X-API-KEY</C> and{' '}
              <C>Authorization: Bearer</C> are also accepted. When you call the slug-based URL, the key must belong to that slug.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
              Never expose your API key in browser JavaScript or a mobile app. Call PalkiPay only from your server.
            </p>
          </Section>

          <Section id="create-payment" title="Create payment">
            <Endpoint method="POST" path={`${BASE}/api/checkout-v2`} />
            <Params
              rows={[
                ['full_name', 'string', 'yes', 'Customer’s name.'],
                ['email', 'string', 'no', 'Customer’s email.'],
                ['amount', 'number | string', 'yes', 'Amount in BDT, e.g. "500" or 499.50.'],
                ['metadata', 'object | JSON string', 'no', 'Anything you need back later, e.g. { "order_id": 42 }.'],
                ['redirect_url', 'URL', 'no', 'Where the customer goes after a successful (or in-review) payment.'],
                ['return_type', '"GET" | "POST"', 'no', 'How invoice_id is sent to redirect_url. Default GET.'],
                ['cancel_url', 'URL', 'no', 'Where the customer goes if they cancel or the payment fails.'],
                ['webhook_url', 'URL', 'no', 'Your endpoint that receives the completed-payment webhook.'],
                ['description', 'string', 'no', 'Shown on the checkout page.'],
              ]}
            />
            <Code title="Request">{`curl -X POST "${BASE}/api/checkout-v2" \\
  -H "Content-Type: application/json" \\
  -H "PALKIPAY-API-KEY: YOUR_API_KEY" \\
  -d '{
    "full_name": "Rahim Uddin",
    "email": "rahim@example.com",
    "amount": "500",
    "metadata": { "order_id": "1042" },
    "redirect_url": "https://yourshop.com/success",
    "cancel_url": "https://yourshop.com/cart",
    "webhook_url": "https://yourshop.com/api/palkipay-webhook"
  }'`}</Code>
            <Code title="Response · 200">{`{
  "status": true,
  "message": "Payment Url",
  "payment_url": "${BASE}/checkout/Erm9wzjM0FBwjSYT0QVb",
  "invoice_id": "Erm9wzjM0FBwjSYT0QVb"
}`}</Code>
          </Section>

          <Section id="verify-payment" title="Verify payment">
            <Endpoint method="POST" path={`${BASE}/api/verify-payment`} />
            <Params rows={[['invoice_id', 'string', 'yes', 'The invoice ID from create payment or the redirect.']]} />
            <Code title="Response · 200">{`{
  "full_name": "Rahim Uddin",
  "email": "rahim@example.com",
  "amount": "500.00",
  "fee": "0.00",
  "charged_amount": "500.00",
  "paid_amount": "500.00",
  "invoice_id": "Erm9wzjM0FBwjSYT0QVb",
  "metadata": { "order_id": "1042" },
  "payment_method": "bkash",
  "sender_number": "01712345678",
  "transaction_id": "BK7Q2M9XW4",
  "date": "2026-09-29 16:30:12",
  "status": "COMPLETED",
  "status_detail": "completed"
}`}</Code>
            <p>
              Fulfil the order only when <C>status</C> is <C>COMPLETED</C>. Dates are in Bangladesh time (UTC+6).
            </p>
          </Section>

          <Section id="redirects" title="Redirects">
            <p>
              After a successful payment the customer is sent to <C>redirect_url</C> with the invoice ID — as a query parameter (<C>?invoice_id=…</C>) for{' '}
              <C>return_type: &quot;GET&quot;</C>, or as a form field for <C>&quot;POST&quot;</C>. Payments that go to manual review also return there, with status{' '}
              <C>PENDING</C>. Always call Verify payment — never trust the redirect alone.
            </p>
          </Section>

          <Section id="webhooks" title="Webhooks">
            <p>
              When a payment completes, PalkiPay sends a <C>POST</C> with the same JSON body as Verify payment to the payment’s <C>webhook_url</C> (or your default
              webhook from Settings). The request carries your API key in the <C>PALKIPAY-API-KEY</C> header so you can check it came from PalkiPay. Respond with any
              2xx status; failed deliveries are retried after 10 seconds, 1 minute and 5 minutes.
            </p>
            <Code title="Next.js webhook handler">{`// app/api/palkipay-webhook/route.ts
export async function POST(req: Request) {
  if (req.headers.get("palkipay-api-key") !== process.env.PALKIPAY_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }
  const payment = await req.json();
  if (payment.status === "COMPLETED") {
    await markOrderPaid(payment.metadata.order_id, payment.transaction_id);
  }
  return Response.json({ ok: true });
}`}</Code>
          </Section>

          <Section id="statuses" title="Payment statuses">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] text-left text-[13.5px]">
                <thead className="bg-slate-50 text-[12px] text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">status</th>
                    <th className="px-4 py-2.5 font-semibold">status_detail</th>
                    <th className="px-4 py-2.5 font-semibold">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['PENDING', 'unpaid', 'Created, customer has not paid yet.'],
                    ['PENDING', 'processing', 'Transaction ID submitted, waiting for the wallet SMS.'],
                    ['PENDING', 'pending', 'SMS did not arrive in time — waiting for the merchant to review.'],
                    ['COMPLETED', 'completed', 'Paid and verified. Safe to fulfil.'],
                    ['FAILED', 'failed', 'Insufficient amount, or rejected by the merchant.'],
                    ['CANCELLED', 'cancelled', 'The customer cancelled.'],
                    ['EXPIRED', 'expired', 'The link expired before payment.'],
                  ].map(([s, d, m]) => (
                    <tr key={d}>
                      <td className="px-4 py-2.5 font-mono text-[12.5px] font-semibold text-slate-900">{s}</td>
                      <td className="px-4 py-2.5 font-mono text-[12.5px] text-slate-500">{d}</td>
                      <td className="px-4 py-2.5 text-slate-600">{m}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="device-api" title="SMS forwarding API">
            <p>
              Used by the PalkiPay Android app and iOS Shortcut to forward incoming wallet SMS. Authenticate with a <b>device key</b> (Dashboard → Devices) in the{' '}
              <C>X-Device-Key</C> header.
            </p>
            <Endpoint method="POST" path={`${BASE}/api/device/sms`} />
            <Params
              rows={[
                ['message', 'string', 'yes', 'The full SMS text.'],
                ['sender', 'string', 'no', 'The SMS sender ID, e.g. bKash, NAGAD, 16216, upay.'],
                ['received_at', 'ISO date | epoch ms', 'no', 'When the SMS arrived. Defaults to now.'],
                ['provider', 'bkash | nagad | rocket | upay', 'no', 'Hint when the sender ID is unknown.'],
              ]}
            />
            <Code title="Response · 200">{`{
  "status": true,
  "result": "stored",            // stored | duplicate | invalid
  "provider": "bkash",
  "transaction_id": "BK7Q2M9XW4",
  "amount": 500,
  "matched_invoice": "Erm9wzjM0FBwjSYT0QVb",
  "payment_status": "completed"
}`}</Code>
            <p>Other device endpoints:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <C>POST /api/device/login</C> — sign in with dashboard email + password; returns a new <C>device_key</C>.
              </li>
              <li>
                <C>POST /api/device/sms/bulk</C> — up to 100 messages as <C>{'{ "messages": [...] }'}</C> for offline sync.
              </li>
              <li>
                <C>GET /api/device/stats</C>, <C>GET /api/device/messages?status=</C>, <C>POST /api/device/heartbeat</C>, <C>GET /api/device/me</C>.
              </li>
            </ul>
          </Section>

          <Section id="errors" title="Errors">
            <p>
              Errors return a non-2xx HTTP status and a JSON body with <C>status: false</C> and a human-readable <C>message</C>. Validation errors (422) also include an{' '}
              <C>errors</C> object keyed by field.
            </p>
            <Code>{`{
  "status": false,
  "message": "Amount must be greater than 0",
  "errors": { "amount": "Amount must be greater than 0" }
}`}</Code>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><b>401</b> — missing or invalid API key / device key.</li>
              <li><b>404</b> — invoice not found (or it belongs to another merchant).</li>
              <li><b>409</b> — conflict, e.g. a Transaction ID that was already used.</li>
              <li><b>422</b> — validation failed.</li>
              <li><b>429</b> — too many requests; slow down and retry.</li>
            </ul>
          </Section>
        </article>
      </div>
      <SiteFooter />
    </>
  );
}
