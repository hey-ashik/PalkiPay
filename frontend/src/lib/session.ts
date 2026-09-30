'use client';

import useSWR from 'swr';
import { api, fetcher } from './api';
import type { Session } from './types';

type SessionResponse = (Session & { status: boolean; authenticated: true }) | { status: boolean; authenticated: false };

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR<SessionResponse>('/api/auth/session', fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const session = data && data.authenticated ? data : undefined;
  const unauthenticated = Boolean(data && !data.authenticated);
  return {
    session,
    error,
    isLoading,
    unauthenticated,
    /** Pass a fresh session payload (e.g. from login) or call with no args to refetch. */
    mutate: (next?: Session) => (next ? mutate({ ...next, status: true, authenticated: true }, { revalidate: false }) : mutate()),
  };
}

export async function logout() {
  await api.post('/api/auth/logout').catch(() => {});
  window.location.href = '/login';
}

/** Where to send a signed-in user. */
export const homeFor = (session: Pick<Session, 'user'>) =>
  session.user.slug ? `/${session.user.slug}/dashboard` : '/onboarding';
