const moneyFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ৳1,25,000.00 — Bangladesh uses lakh grouping. */
export const money = (value: number | string | null | undefined) =>
  value == null ? '—' : `৳${moneyFmt.format(Number(value))}`;

/** ৳1,250 — whole taka for headline figures. */
export const moneyShort = (value: number | string | null | undefined) =>
  value == null ? '—' : `৳${compactFmt.format(Math.round(Number(value)))}`;

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric' });

export const dateTime = (value: string | null | undefined) => (value ? dateTimeFmt.format(new Date(value)) : '—');
export const date = (value: string | null | undefined) => (value ? dateFmt.format(new Date(value)) : '—');

export function timeAgo(value: string | null | undefined) {
  if (!value) return 'never';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date(value);
}

export function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: 'numeric', hour12: false }).format(new Date())
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');
