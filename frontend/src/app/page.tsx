import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  Code2,
  Link2,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Zap,
  Check,
  Wallet,
  Send,
} from 'lucide-react';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { ButtonLink } from '@/components/ui/button';
import { ProviderMark, ProviderWordmark } from '@/components/brand/provider-mark';
import { LogoMark } from '@/components/brand/logo';
import type { ProviderId } from '@/lib/types';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant SMS verification',
    text: 'Your phone forwards the wallet SMS the moment money lands. PalkiPay matches the Transaction ID and amount, then confirms the order automatically.',
  },
  {
    icon: Link2,
    title: 'Your own payment URL',
    text: 'Every merchant gets a dedicated address like palkipay.ashiik.com/yourshop — your checkout, your brand, your customers.',
  },
  {
    icon: Send,
    title: 'Telegram approvals',
    text: 'Get notified on Telegram for every payment. When something needs a human, approve or reject with one tap right from the chat.',
  },
  {
    icon: Code2,
    title: 'Developer-friendly API',
    text: 'Create a payment with one request and verify it with another. UddoktaPay-compatible, so existing plugins work by changing the base URL.',
  },
  {
    icon: Smartphone,
    title: 'iPhone & Android forwarding',
    text: 'Use an iOS Shortcut automation or the Android forwarder app. Add as many phones as you have wallet numbers.',
  },
  {
    icon: ShieldCheck,
    title: 'Fraud protection built in',
    text: 'Every Transaction ID can be used once. Short payments are flagged, not accepted. Old or fake IDs never match.',
  },
];

const STEPS = [
  { icon: BadgeCheck, title: 'Create your account', text: 'Sign up and claim your unique PalkiPay URL in under a minute.' },
  { icon: Wallet, title: 'Add wallet numbers', text: 'Enter your bKash, Nagad, Rocket or Upay personal or agent numbers.' },
  { icon: MessageSquareText, title: 'Connect your phone', text: 'Link the phone that receives the wallet SMS with a secure device key.' },
  { icon: Code2, title: 'Integrate & get paid', text: 'Call the API from your store — or share a payment link — and start collecting.' },
];

const FAQ = [
  {
    q: 'Do I need a merchant account with bKash or Nagad?',
    a: 'No. PalkiPay works with regular personal (or agent) wallet numbers. Customers use Send Money (or Cash Out for agent numbers), then enter the Transaction ID on your checkout page.',
  },
  {
    q: 'How does automatic verification work?',
    a: 'The phone that holds your wallet SIM forwards incoming payment SMS to PalkiPay. When a customer submits a Transaction ID, we match it against those messages and check that the amount is enough. A match confirms the payment instantly.',
  },
  {
    q: 'What happens if the SMS is delayed?',
    a: 'The customer sees a verifying screen while PalkiPay keeps checking. If the SMS still hasn’t arrived after the timeout, the payment goes to review and you get a Telegram message with Approve and Reject buttons. If the SMS arrives later, it is confirmed automatically.',
  },
  {
    q: 'What if a customer sends less than the amount?',
    a: 'The payment is marked as insufficient and the customer is told immediately. You are notified and can still approve it manually if you wish.',
  },
  {
    q: 'Can I use it with my existing website?',
    a: 'Yes. Any backend that can make an HTTPS request can integrate — Next.js, Laravel, WordPress/WooCommerce and more. The API follows UddoktaPay’s request and response format.',
  },
  {
    q: 'Can I change my PalkiPay URL later?',
    a: 'Your URL is permanent once claimed, because your integrations and customers rely on it. Choose carefully — each account gets exactly one.',
  },
];

const CODE = `// app/api/pay/route.ts  (Next.js)
export async function POST(req: Request) {
  const order = await req.json();

  const res = await fetch(
    "https://palkipay.ashiik.com/yourshop/api/checkout-v2",
    {
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
        redirect_url: "https://yourshop.com/thank-you",
        cancel_url: "https://yourshop.com/cart",
        webhook_url: "https://yourshop.com/api/palkipay",
      }),
    }
  );

  const { payment_url } = await res.json();
  return Response.json({ payment_url }); // redirect the customer here
}`;

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[400px] lg:mr-0">
      <div className="absolute -inset-10 -z-10 rounded-[3rem] bg-gradient-to-br from-brand-400/25 via-brand-600/10 to-transparent blur-2xl" />

      {/* Checkout card */}
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_30px_80px_-20px_rgb(15_23_42/0.35)]">
        <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #E2136E 0%, #C10F5D 100%)' }}>
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/20 text-xs font-extrabold">bK</span>
              <div>
                <p className="text-sm font-bold leading-tight">bKash Payment</p>
                <p className="text-[11px] text-white/75">Send Money · Personal</p>
              </div>
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">Secure</span>
          </div>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-wider text-white/70">Amount to pay</p>
          <p className="text-3xl font-bold text-white">৳1,250.00</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          {['Dial *247# or open the bKash app', 'Send Money to 01XXX-XXX890', 'Paste your Transaction ID below'].map((t, i) => (
            <div key={t} className="flex items-center gap-3 text-[13px] text-slate-600">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#FDECF3] text-[11px] font-bold text-[#E2136E]">{i + 1}</span>
              {t}
            </div>
          ))}
          <div className="rounded-xl border-2 border-[#E2136E]/30 bg-[#FDECF3]/40 px-3.5 py-2.5 font-mono text-sm tracking-widest text-slate-800">
            BK7Q2M9XW4
          </div>
          <div className="rounded-xl py-2.5 text-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #E2136E 0%, #C10F5D 100%)' }}>
            Verify payment
          </div>
        </div>
      </div>

      {/* Floating notifications */}
      <div className="absolute -left-6 top-24 hidden w-60 animate-float rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lift backdrop-blur sm:block">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <Check className="size-4" strokeWidth={3} />
          </span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-900">Payment verified</p>
            <p className="text-[11px] text-slate-500">৳1,250 · bKash · 2s ago</p>
          </div>
        </div>
      </div>
      <div className="absolute -right-4 -bottom-6 hidden w-64 animate-float rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-lift backdrop-blur [animation-delay:1.5s] sm:block">
        <div className="flex items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-600">
            <BellRing className="size-4" />
          </span>
          <div>
            <p className="text-[12.5px] font-bold text-slate-900">Telegram</p>
            <p className="text-[11px] leading-snug text-slate-500">✅ Payment received — Invoice #Xk29… ৳1,250 from 01712•••678</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const providers: ProviderId[] = ['bkash', 'nagad', 'rocket', 'upay'];
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="relative -mt-16 overflow-hidden pt-16">
          <div className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-brand-50 via-white to-white" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:pt-20 lg:pb-28">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-[12.5px] font-semibold text-brand-700 shadow-card">
                <span className="size-1.5 rounded-full bg-brand-500" /> Built for Bangladeshi businesses
              </span>
              <h1 className="mt-6 text-[40px] font-bold leading-[1.06] tracking-[-0.03em] text-slate-900 sm:text-[54px]">
                Accept bKash, Nagad &amp; Rocket — <span className="text-brand-gradient">verified automatically.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600">
                PalkiPay turns your personal wallet numbers into a complete payment gateway. Customers pay, your phone
                forwards the SMS, and orders confirm themselves in seconds — no merchant account needed.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/register" size="lg">
                  Create free account <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/docs" size="lg" variant="secondary">
                  <Code2 className="size-4" /> Read the API docs
                </ButtonLink>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-medium text-slate-500">
                {['No merchant account', 'Your own payment URL', 'Telegram alerts'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <Check className="size-4 text-emerald-500" strokeWidth={3} /> {t}
                  </span>
                ))}
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* Supported wallets */}
        <section className="border-y border-slate-100 bg-slate-50/60">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-9 sm:px-6 md:flex-row md:justify-between lg:px-8">
            <p className="text-sm font-semibold text-slate-500">Accept payments from every major mobile wallet</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {providers.map((p) => (
                <ProviderWordmark key={p} provider={p} className="min-w-24 shadow-sm" />
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-brand-600">Everything included</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[40px] sm:leading-tight">
                A payment gateway that runs on the numbers you already have
              </h2>
              <p className="mt-4 text-[16px] text-slate-600">
                Stop checking your phone for every order. PalkiPay does the matching, the notifications and the
                bookkeeping for you.
              </p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="grid size-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-canvas py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-brand-600">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[40px] sm:leading-tight">
                Live in four steps
              </h2>
            </div>
            <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title} className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
                  <span className="absolute right-5 top-5 text-4xl font-bold text-slate-100">{String(i + 1).padStart(2, '0')}</span>
                  <div className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 text-[16px] font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{text}</p>
                </li>
              ))}
            </ol>

            {/* Flow diagram */}
            <div className="mt-10 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
              <div className="grid items-center gap-4 text-center md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
                {[
                  { label: 'Customer pays', sub: 'Send Money to your number', mark: <ProviderMark provider="bkash" /> },
                  { label: 'Phone forwards SMS', sub: 'iOS Shortcut / Android app', mark: <span className="grid size-10 place-items-center rounded-xl bg-slate-900 text-white"><Smartphone className="size-5" /></span> },
                  { label: 'PalkiPay verifies', sub: 'TrxID + amount matched', mark: <LogoMark className="size-10" /> },
                  { label: 'Order confirmed', sub: 'Webhook + Telegram alert', mark: <span className="grid size-10 place-items-center rounded-xl bg-emerald-500 text-white"><Check className="size-5" strokeWidth={3} /></span> },
                ].map((s, i, arr) => (
                  <div key={s.label} className="contents">
                    <div className="flex flex-col items-center gap-2">
                      {s.mark}
                      <p className="text-sm font-semibold text-slate-900">{s.label}</p>
                      <p className="text-[12.5px] text-slate-500">{s.sub}</p>
                    </div>
                    {i < arr.length - 1 && <ArrowRight className="mx-auto size-5 rotate-90 text-slate-300 md:rotate-0" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Developers */}
        <section id="developers" className="scroll-mt-20 bg-navy-900 py-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-brand-300">For developers</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-[40px] sm:leading-tight">
                Two endpoints. That’s the whole integration.
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-slate-300">
                Create a payment, redirect the customer, verify on return. Webhooks tell your backend the moment money
                arrives. Works with Next.js, Laravel, WordPress — anything that speaks HTTP.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  'UddoktaPay-compatible requests and responses',
                  'API key scoped to your own payment URL',
                  'Webhooks with automatic retries',
                  'Payment links for when you have no website',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3 text-[15px] text-slate-200">
                    <span className="grid size-5 place-items-center rounded-full bg-brand-500/20 text-brand-300">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/docs" size="lg">
                  Explore the API <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
            </div>
            <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-navy-950 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="size-3 rounded-full bg-[#ff5f57]" />
                <span className="size-3 rounded-full bg-[#febc2e]" />
                <span className="size-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-slate-400">route.ts</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-slate-300">
                <code>{CODE}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-brand-600">FAQ</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-[40px]">Questions, answered</h2>
            </div>
            <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-card">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15.5px] font-semibold text-slate-900">
                    {f.q}
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition group-open:rotate-45 group-open:bg-brand-50 group-open:text-brand-600">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-brand-gradient-v px-6 py-16 text-center text-white sm:px-12">
            <div className="absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-[40px]">Start accepting payments today</h2>
              <p className="mx-auto mt-4 max-w-xl text-[16px] text-white/85">
                Create your account, claim your PalkiPay URL and take your first automated payment in minutes.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/register" size="lg" variant="secondary" className="!text-brand-700">
                  Create free account <ArrowRight className="size-4" />
                </ButtonLink>
                <ButtonLink href="/login" size="lg" variant="ghost" className="!text-white hover:!bg-white/10">
                  Sign in
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
