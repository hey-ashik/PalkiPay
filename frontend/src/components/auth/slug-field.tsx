'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/field';
import { Spinner } from '@/components/ui/misc';
import { api } from '@/lib/api';

export interface SlugState {
  value: string;
  available: boolean | null;
  checking: boolean;
  /** The availability check itself failed (e.g. the server is unavailable). */
  failed?: boolean;
}

interface CheckResponse {
  slug: string;
  available: boolean;
  message: string;
  suggestions: string[];
}

/** URL-slug input with live availability check and suggestions. */
export function SlugField({
  value,
  onChange,
  error,
  autoFocus,
}: {
  value: string;
  onChange: (state: SlugState) => void;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const [host, setHost] = useState('palkipay.ashiik.com');
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => setHost(window.location.host), []);

  useEffect(() => {
    const slug = value.trim().toLowerCase();
    if (!slug) {
      setResult(null);
      onChange({ value, available: null, checking: false });
      return;
    }
    const id = ++seq.current;
    setChecking(true);
    setCheckError(null);
    onChange({ value, available: null, checking: true });
    const t = setTimeout(async () => {
      try {
        const r = await api.get<CheckResponse>(`/api/slugs/check?slug=${encodeURIComponent(slug)}`);
        if (id !== seq.current) return;
        setResult(r);
        onChange({ value, available: r.available, checking: false });
      } catch (err) {
        if (id !== seq.current) return;
        setResult(null);
        setCheckError(err instanceof Error ? err.message : 'Could not check this URL right now.');
        onChange({ value, available: null, checking: false, failed: true });
      } finally {
        if (id === seq.current) setChecking(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const status = checking ? (
    <Spinner className="size-4 text-slate-400" />
  ) : result?.available ? (
    <CheckCircle2 className="size-5 text-emerald-500" />
  ) : result ? (
    <XCircle className="size-5 text-red-500" />
  ) : null;

  return (
    <div>
      <Input
        label="Your PalkiPay URL"
        prefix={`${host}/`}
        placeholder="yourshop"
        value={value}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        maxLength={32}
        onChange={(e) => onChange({ value: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''), available: null, checking: true })}
        trailing={status}
        error={error}
      />
      {!error && result && !checking && (
        <div className="mt-1.5 text-[12.5px]">
          <p className={result.available ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>{result.message}</p>
          {result.suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-slate-500">Try:</span>
              {result.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ value: s, available: null, checking: true })}
                  className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!error && !result && !checking && checkError && (
        <p className="mt-1.5 text-[12.5px] font-medium text-amber-700">Couldn’t check availability: {checkError}</p>
      )}
      {!error && !result && !checking && !checkError && (
        <p className="mt-1.5 text-[12.5px] text-slate-500">
          Letters, numbers and hyphens. This becomes your permanent payment address — one per account.
        </p>
      )}
    </div>
  );
}
