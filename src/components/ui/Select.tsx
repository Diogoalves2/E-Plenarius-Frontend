'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Linha de apoio abaixo do rótulo (ex.: "não vota"). */
  hint?: string;
}

/**
 * Select com o visual do projeto no lugar do <select> do navegador.
 * Teclado: setas, Home/End, Enter/Espaço, Esc e busca pela primeira letra.
 * A lista abre num portal (não é cortada por modais com rolagem) e vira para cima
 * quando falta espaço embaixo.
 */
export function Select<V extends string = string>({
  value, onChange, options, ariaLabel, placeholder = 'Selecione', size = 'md', className = '', title, disabled,
}: {
  value: V;
  onChange: (v: V) => void;
  options: SelectOption<V>[];
  ariaLabel?: string;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = options.find(o => o.value === value);

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const want = Math.min(280, options.length * 40 + 8);
    const up = below < Math.min(want, 180) && above > below;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up, maxH: Math.max(120, Math.min(280, up ? above : below)) });
  }, [options.length]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || listRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  // Mantém o item ativo visível ao navegar pelo teclado
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  }
  function choose(i: number) {
    const o = options[i];
    if (o) onChange(o.value);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const from = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(k));
      const i = from >= 0 ? from : options.findIndex(o => o.label.toLowerCase().startsWith(k));
      if (i >= 0) setActive(i);
    }
  }

  const sm = size === 'sm';
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={`w-full flex items-center gap-2 text-left rounded-lg bg-white border transition-colors outline-none
          ${open ? 'border-[#1447E6]' : 'border-[rgba(15,23,42,0.12)] hover:border-[rgba(15,23,42,0.24)]'}
          focus-visible:border-[#1447E6] disabled:opacity-60 disabled:cursor-not-allowed
          ${sm ? 'h-9 px-2.5 text-[13px]' : 'h-[42px] px-3.5 text-sm'} ${className}`}
      >
        <span className="flex-1 min-w-0 truncate" style={{ color: current ? '#0B1220' : '#94A3B8' }}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={sm ? 14 : 16} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: '#94A3B8' }} />
      </button>

      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="fixed z-[200] py-1 rounded-xl bg-white overflow-y-auto animate-[selIn_.12s_ease-out]"
          style={{
            left: pos.left, width: Math.max(pos.width, 180), maxHeight: pos.maxH,
            ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
            border: '1px solid rgba(15,23,42,0.08)',
            boxShadow: '0 12px 32px -8px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.06)',
          }}
        >
          <style>{`@keyframes selIn{from{opacity:0;transform:translateY(${pos.up ? '4px' : '-4px'})}to{opacity:1;transform:none}}`}</style>
          {options.map((o, i) => {
            const sel = o.value === value;
            return (
              <li
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(i)}
                className="mx-1 px-2.5 py-2 rounded-lg flex items-start gap-2 cursor-pointer select-none"
                style={{ background: i === active ? '#F1F5F9' : undefined }}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate" style={{ color: sel ? '#1447E6' : '#0B1220', fontWeight: sel ? 600 : 400 }}>{o.label}</span>
                  {o.hint && <span className="block text-xs mt-0.5" style={{ color: '#94A3B8' }}>{o.hint}</span>}
                </span>
                {sel && <Check size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#1447E6' }} />}
              </li>
            );
          })}
        </ul>,
        document.body,
      )}
    </>
  );
}
