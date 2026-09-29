import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Geist_Mono, Noto_Sans_Bengali } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

// Only used for Bengali glyphs such as the taka sign (৳), which Plus Jakarta Sans lacks.
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bengali',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PalkiPay — Automated bKash, Nagad & Rocket payments',
    template: '%s · PalkiPay',
  },
  description:
    'PalkiPay turns your personal bKash, Nagad, Rocket and Upay numbers into an automated payment gateway. SMS-verified payments, Telegram approvals and a developer-friendly API.',
  applicationName: 'PalkiPay',
};

export const viewport: Viewport = {
  themeColor: '#006cfa',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${bengali.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      </body>
    </html>
  );
}
