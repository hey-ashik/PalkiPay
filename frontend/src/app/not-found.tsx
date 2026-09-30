import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <p className="mt-10 text-7xl font-bold tracking-tight text-slate-200">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-slate-500">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-7 flex gap-2">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          Merchant login
        </ButtonLink>
      </div>
    </div>
  );
}
