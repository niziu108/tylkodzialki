'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ');
}

function sanitizeHtmlBasic(input: string) {
  if (!input) return '';
  let out = input.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  out = out.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  out = out.replace(/\son\w+="[^"]*"/gi, '');
  out = out.replace(/\son\w+='[^']*'/gi, '');
  out = out.replace(/href\s*=\s*["']\s*javascript:[^"']*["']/gi, 'href="#"');
  return out;
}

type Props = {
  value: string;
  onChange: (html: string) => void;
  title?: string;
};

export default function OpisEditor({
  value,
  onChange,
  title = 'Opis oferty',
}: Props) {
  const id = useId();
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    ul: false,
    ol: false,
  });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if ((el.innerHTML || '') !== (value || '')) {
      el.innerHTML = value || '';
    }
  }, [value]);

  const updateActive = () => {
    // @ts-ignore
    const bold = document.queryCommandState('bold');
    // @ts-ignore
    const italic = document.queryCommandState('italic');
    // @ts-ignore
    const ul = document.queryCommandState('insertUnorderedList');
    // @ts-ignore
    const ol = document.queryCommandState('insertOrderedList');
    setActive({ bold, italic, ul, ol });
  };

  const exec = (cmd: string) => {
    // @ts-ignore
    document.execCommand(cmd, false);
    const html = sanitizeHtmlBasic(ref.current?.innerHTML || '');
    onChange(html);
    updateActive();
    ref.current?.focus();
  };

  const onInput = () => {
    const html = sanitizeHtmlBasic(ref.current?.innerHTML || '');
    onChange(html);
    updateActive();
  };

  const placeholder = useMemo(() => 'Opisz szczegółowo działkę…', []);

  const isEmpty =
    !value || value.replace(/<[^>]*>/g, '').trim().length === 0;

  function Tool({
    isOn,
    label,
    onClick,
  }: {
    isOn: boolean;
    label: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cx(
          'text-[14px] md:text-[15px] font-semibold tracking-tight transition',
          isOn ? 'text-white' : 'text-white/70 hover:text-white'
        )}
        style={{
          textDecoration: isOn ? 'underline' : 'none',
          textUnderlineOffset: '10px',
          textDecorationThickness: '1px',
          textDecorationColor: isOn
            ? 'rgba(243,239,245,0.95)'
            : 'transparent',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[22px] md:text-[26px] font-semibold tracking-tight text-white">
        {title}
      </h2>

      <div className="flex flex-wrap gap-8">
        <Tool isOn={active.bold} label="Pogrub" onClick={() => exec('bold')} />
        <Tool isOn={active.italic} label="Kursywa" onClick={() => exec('italic')} />
        <Tool isOn={active.ul} label="Punktuj" onClick={() => exec('insertUnorderedList')} />
        <Tool isOn={active.ol} label="Numeruj" onClick={() => exec('insertOrderedList')} />
      </div>

      <div className="relative">
        {isEmpty && (
          <div className="pointer-events-none absolute left-0 top-0 w-full text-white/35 text-[18px] md:text-[19px] leading-relaxed">
            {placeholder}
          </div>
        )}

        <div
          id={id}
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onInput={onInput}
          onKeyUp={updateActive}
          onMouseUp={updateActive}
          onFocus={updateActive}
          className={cx(
            'min-h-[110px] w-full bg-transparent',
            'text-[18px] md:text-[19px] text-white/90 leading-relaxed',
            'outline-none focus:outline-none',
            'border-0 pb-1',
            'rounded-none shadow-none ring-0',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
            '[&_li]:my-1',
            '[&_b]:text-white [&_strong]:text-white'
          )}
          style={{
            outline: 'none',
            boxShadow: 'none',
          }}
        />
      </div>

      {/* ✅ ZAZNACZENIE TEKSTU — bez CSS.escape, bez błędu SSR */}
      <style jsx>{`
        #${id}::selection,
        #${id} *::selection {
          background: rgba(243, 239, 245, 0.35);
          color: rgba(255, 255, 255, 0.98);
        }
      `}</style>
    </div>
  );
}