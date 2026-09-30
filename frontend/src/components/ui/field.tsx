'use client';

import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/format';

export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
      {children}
      {optional && <span className="font-normal text-slate-400">(optional)</span>}
    </label>
  );
}

const inputBase =
  'block w-full rounded-xl border bg-white px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 transition outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12 disabled:bg-slate-50 disabled:text-slate-500';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  /** Fixed text shown before the input, e.g. a URL prefix */
  prefix?: string;
  trailing?: React.ReactNode;
  inputClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, optional, prefix, trailing, className, inputClassName, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={inputId} optional={optional}>
          {label}
        </Label>
      )}
      <div
        className={cn(
          'relative flex items-stretch',
          prefix &&
            'overflow-hidden rounded-xl border bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/12',
          prefix && (error ? 'border-red-400' : 'border-slate-200')
        )}
      >
        {prefix && (
          <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-500 select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={cn(
            prefix ? 'block w-full min-w-0 bg-transparent px-3 text-[14px] text-slate-900 outline-none placeholder:text-slate-400' : inputBase,
            'h-11',
            !prefix && (error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200'),
            trailing ? 'pr-11' : '',
            inputClassName
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>}
      </div>
      {error ? (
        <p className="mt-1.5 text-[12.5px] font-medium text-red-600">{error}</p>
      ) : hint ? (
        <div className="mt-1.5 text-[12.5px] text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-lg p-2 text-slate-400 hover:text-slate-700"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

export function Textarea({
  label,
  hint,
  error,
  optional,
  className,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string; error?: string; optional?: boolean }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={inputId} optional={optional}>
          {label}
        </Label>
      )}
      <textarea
        id={inputId}
        className={cn(inputBase, 'min-h-24 py-2.5', error ? 'border-red-400' : 'border-slate-200')}
        {...props}
      />
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-[12.5px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Select({
  label,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={className}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <select id={inputId} className={cn(inputBase, 'h-11 border-slate-200 pr-8')} {...props}>
        {children}
      </select>
    </div>
  );
}

/** Live password-rule checklist (matches the backend rules). */
export function PasswordRules({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 8, label: 'Minimum 8 characters' },
    { ok: /[a-z]/.test(value), label: 'One lowercase letter' },
    { ok: /[A-Z]/.test(value), label: 'One uppercase letter' },
    { ok: /\d/.test(value), label: 'One number' },
  ];
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
      {rules.map((r) => (
        <li key={r.label} className={cn('flex items-center gap-1.5 text-[12px] transition-colors', r.ok ? 'text-emerald-600' : 'text-slate-400')}>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {r.ok ? <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx="8" cy="8" r="5.5" />}
          </svg>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

export const passwordValid = (v: string) => v.length >= 8 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v);
