'use client';

// Czyste (bezstanowe) komponenty i helpery formularza dodawania działki.
// Wydzielone z DzialkaForm.tsx, żeby odchudzić monolit; ZERO zmiany zachowania.

import type { ReactNode, HTMLAttributes, ClipboardEvent } from 'react';

export function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

export function Hr({ className }: { className?: string }) {
  return <div className={cx('border-b border-fg/10', className)} />;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-[17px] md:text-[19px] font-semibold tracking-tight text-fg">{children}</h2>;
}

export function UnderlineField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  maxLength,
  showCounter,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  maxLength?: number;
  showCounter?: boolean;
  required?: boolean;
  error?: boolean;
}) {
  return (
    <label className="block" data-field-error={error ? 'true' : undefined}>
      <div className="flex items-end justify-between gap-4">
        <div className={cx(
          'text-[11px] uppercase tracking-[0.18em]',
          error ? 'text-red-400/90' : 'text-fg/70'
        )}>
          {label}
          {required ? <span className={error ? 'text-red-400' : 'text-brand-bright'}> *</span> : null}
        </div>
        {showCounter && typeof maxLength === 'number' ? (
          <div className="text-[11px] tracking-[0.12em] text-fg/64">
            {value.length}/{maxLength}
          </div>
        ) : null}
      </div>

      <input
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cx(
          // .field-line = pełna linia pod polem (przebija globalny reset input{border:none});
          // szara w spoczynku, zielona tylko w foku (podczas pisania), czerwona przy błędzie.
          'field-line mt-2 w-full bg-transparent pb-2 text-[18px] md:text-[19px] text-fg/90',
          'placeholder:text-fg/62 outline-none focus:ring-0',
          error ? 'field-line-error' : '',
          'selection:bg-fg/20 selection:text-fg'
        )}
      />
    </label>
  );
}

export function Tabs({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx('text-[15px] font-semibold tracking-tight transition', active ? 'text-fg' : 'text-fg/70 hover:text-fg')}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'var(--brand-bright)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MultiTabs({
  values,
  toggle,
  options,
}: {
  values: string[];
  toggle: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            className={cx(
              'text-[13px] md:text-[14px] font-semibold uppercase tracking-[0.08em] transition',
              active ? 'text-fg' : 'text-fg/70 hover:text-fg'
            )}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'var(--brand-bright)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceRow({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-8">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx('text-[14px] md:text-[15px] font-semibold tracking-tight transition', active ? 'text-fg' : 'text-fg/70 hover:text-fg')}
            style={{
              textDecoration: active ? 'underline' : 'none',
              textUnderlineOffset: '10px',
              textDecorationThickness: '1px',
              textDecorationColor: active ? 'var(--brand-bright)' : 'transparent',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Wklejanie do opisu jako czysty tekst (bez formatowania ze schowka).
export function handleOpisPasteAsPlainText(e: ClipboardEvent<HTMLDivElement>) {
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const textarea = target.closest('textarea') as HTMLTextAreaElement | null;
  const input = target.closest('input') as HTMLInputElement | null;
  const editable = target.closest('[contenteditable="true"]') as HTMLElement | null;

  if (!textarea && !input && !editable) return;

  e.preventDefault();

  if (textarea || input) {
    const el = (textarea ?? input)!;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const nextValue = el.value.slice(0, start) + text + el.value.slice(end);

    const proto = Object.getPrototypeOf(el);
    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    valueSetter?.call(el, nextValue);
    el.dispatchEvent(new Event('input', { bubbles: true }));

    requestAnimationFrame(() => {
      const pos = start + text.length;
      el.setSelectionRange?.(pos, pos);
    });

    return;
  }

  if (editable) {
    editable.focus();

    if (document.queryCommandSupported?.('insertText')) {
      document.execCommand('insertText', false, text);
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    selection.deleteFromDocument();
    const range = selection.getRangeAt(0);
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    editable.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
