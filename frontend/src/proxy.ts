import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Fast server-side guard: visitors without a session cookie never see a
 * dashboard shell flash. The API still validates the session on every call.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has('pp_session')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/:slug/dashboard', '/:slug/dashboard/:path*', '/onboarding'],
};
