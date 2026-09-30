import type { ProviderId } from './types';

export interface ProviderMeta {
  id: ProviderId;
  name: string;
  /** Primary brand colour */
  color: string;
  /** Header / button gradient */
  gradient: string;
  /** Text colour on top of the gradient */
  onColor: string;
  /** Soft tint for backgrounds */
  tint: string;
  ussd: string;
  app: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  bkash: {
    id: 'bkash',
    name: 'bKash',
    color: '#E2136E',
    gradient: 'linear-gradient(135deg, #E2136E 0%, #C10F5D 100%)',
    onColor: '#ffffff',
    tint: '#FDECF3',
    ussd: '*247#',
    app: 'bKash app',
  },
  nagad: {
    id: 'nagad',
    name: 'Nagad',
    color: '#EC1C24',
    gradient: 'linear-gradient(135deg, #F7941D 0%, #EC1C24 100%)',
    onColor: '#ffffff',
    tint: '#FEF0E6',
    ussd: '*167#',
    app: 'Nagad app',
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket',
    color: '#8C3494',
    gradient: 'linear-gradient(135deg, #9D3FA6 0%, #6A2171 100%)',
    onColor: '#ffffff',
    tint: '#F5EAF6',
    ussd: '*322#',
    app: 'Rocket app',
  },
  upay: {
    id: 'upay',
    name: 'Upay',
    color: '#0B4EA2',
    gradient: 'linear-gradient(135deg, #FFD43B 0%, #FFC20E 100%)',
    onColor: '#0B3C7D',
    tint: '#FFF8DB',
    ussd: '*268#',
    app: 'Upay app',
  },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

/** Step-by-step payment instructions shown on the checkout page. */
export function paymentSteps(provider: ProviderId, accountType: 'personal' | 'agent') {
  const p = PROVIDERS[provider];
  const action = accountType === 'agent' ? 'Cash Out' : 'Send Money';
  return {
    action,
    steps: [
      `Open the ${p.app} or dial ${p.ussd}`,
      `Choose “${action}”`,
      'Enter the number below',
      'Enter the exact amount below',
      'Confirm with your PIN',
      'Copy the Transaction ID from the confirmation SMS and paste it here',
    ],
  };
}
