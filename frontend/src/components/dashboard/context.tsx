'use client';

import { createContext, useContext } from 'react';
import type { Session } from '@/lib/types';

interface DashboardValue {
  session: Session;
  slug: string;
  /** `/<slug>/dashboard` — prefix for dashboard links */
  base: string;
  /** Public origin, e.g. https://palkipay.ashiik.com */
  origin: string;
  refreshSession: () => void;
}

export const DashboardContext = createContext<DashboardValue | null>(null);

export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error('useDashboard must be used inside the dashboard layout');
  return value;
}
