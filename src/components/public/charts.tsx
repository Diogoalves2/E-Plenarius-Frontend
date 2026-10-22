'use client';

import { useRef, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { T } from './PublicShell';

/**
 * Gráficos do portal em HTML/SVG puros. Regras: marcas finas com cantos de 4px na ponta,
 * 2px de respiro entre segmentos, texto sempre nas cores de texto (a cor fica na marca),
 * legenda para 2+ séries, dica ao passar o mouse/foco e tabela equivalente.
 */

export interface Seg { key: string; label: string; value: number; color: string }

// ── Dica (tooltip) ──────────────────────────────────────────────────────────

interface TipState { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] }

export function useTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: React.PointerEvent | React.FocusEvent, title: string, rows: TipState['rows']) => {
    const host = box.current?.getBoundingClientRect();
    if (!host) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : r.left + r.width / 2;
    const y = 'clientY' in e ? e.clientY : r.top;
    setTip({ x: x - host.left, y: y - host.top, title, rows });
  };
  const hide = () => setTip(null);
  const node = tip && (
    <div role="tooltip" className="absolute z-20 pointer-events-none rounded-lg px-3 py-2 text-xs shadow-lg"
         style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, calc(-100% - 12px))', background: '#fff',
                  border: `1px solid ${T.hair}`, minWidth: 140, whiteSpace: 'nowrap' }}>
      <p className="font-semibold mb-1" style={{ color: T.muted }}>{tip.title}</p>
      {tip.rows.map(r => (
        <p key={r.label} className="flex items-center gap-2" style={{ color: T.ink2 }}>
          {r.color && <span style={{ width: 10, height: 2, background: r.color, borderRadius: 1, display: 'inline-block' }} />}
          <b style={{ color: T.ink }}>{r.value}</b> {r.label}
        </p>
      ))}
    </div>
  );
  return { box, show, hide, node };
}

// ── Peças ───────────────────────────────────────────────────────────────────

export function StatTile({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5" style={{ border: `1px solid ${T.hair}` }}>
      <div className="flex items-center gap-2">
        {accent && <span className="w-2 h-2 rounded-full" style={{ background: accent }} />}
        <p className="text-xs font-medium" style={{ color: T.muted }}>{label}</p>
      </div>
      <p className="font-bold mt-1.5" style={{ fontSize: 28, letterSpacing: '-0.02em', color: T.ink }}>{value}</p>
      {hint && <p className="text-xs mt-0.5" style={{ color: T.muted }}>{hint}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: T.ink2 }}>
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span style={{ width: 10, height: 10, borderRadius: 3, background: i.color, display: 'inline-block',
                         boxShadow: i.color === T.ausente ? `inset 0 0 0 1px ${T.abst}` : undefined }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Cartão de gráfico com alternância gráfico ⇄ tabela (a tabela é o equivalente acessível). */
export function ChartCard({ title, subtitle, legend, table, children, className = '' }: {
  title: string; subtitle?: string; legend?: React.ReactNode; table?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`bg-white rounded-2xl p-4 sm:p-5 ${className}`} style={{ border: `1px solid ${T.hair}` }}>
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold" style={{ color: T.ink }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: T.muted }}>{subtitle}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0"
                  style={{ border: `1px solid ${T.hair}`, color: T.ink2 }}
                  aria-pressed={asTable}>
            {asTable ? <><BarChart3 size={13} /> Gráfico</> : <><Table2 size={13} /> Tabela</>}
          </button>
        )}
      </div>
      {!asTable && legend && <div className="mb-3">{legend}</div>}
      {asTable ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
      <thead>
        <tr>{head.map((h, i) => (
          <th key={h} className={`py-2 px-2 text-xs font-semibold ${i ? 'text-right' : 'text-left'}`}
              style={{ color: T.muted, borderBottom: `1px solid ${T.grid}` }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>{r.map((c, i) => (
            <td key={i} className={`py-2 px-2 ${i ? 'text-right' : 'text-left'}`}
                style={{ color: i ? T.ink2 : T.ink, borderBottom: `1px solid ${T.grid}` }}>{c}</td>
          ))}</tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Barra horizontal empilhada (parte do todo) ──────────────────────────────

export function StackedBar({ segs, height = 12, title, tip, showLabels = false, focusable = true }: {
  segs: Seg[]; height?: number; title: string; tip: ReturnType<typeof useTip>; showLabels?: boolean;
  /** false dentro de links (o valor já está no texto ao lado / na tabela). */
  focusable?: boolean;
}) {
  const total = segs.reduce((n, s) => n + s.value, 0);
  const visible = segs.filter(s => s.value > 0);
  if (!total) {
    return <div className="rounded" style={{ height, background: T.ausente }} aria-label={`${title}: sem dados`} />;
  }
  const rows = segs.map(s => ({ label: s.label, value: `${s.value} (${Math.round((s.value / total) * 100)}%)`, color: s.color }));
  return (
    <div className="flex w-full" style={{ height, gap: 2 }} role="img"
         aria-label={`${title}: ${segs.map(s => `${s.label} ${s.value}`).join(', ')}`}>
      {visible.map((s, i) => {
        const pct = (s.value / total) * 100;
        const first = i === 0, last = i === visible.length - 1;
        return (
          <div key={s.key} tabIndex={focusable ? 0 : undefined}
               onPointerMove={e => tip.show(e, title, rows)} onPointerLeave={tip.hide}
               onFocus={e => tip.show(e, title, rows)} onBlur={tip.hide}
               className="relative flex items-center justify-center outline-none focus-visible:ring-2"
               style={{ width: `${pct}%`, minWidth: 3, background: s.color,
                        borderRadius: `${first ? 4 : 0}px ${last ? 4 : 0}px ${last ? 4 : 0}px ${first ? 4 : 0}px`,
                        boxShadow: s.color === T.ausente ? `inset 0 0 0 1px ${T.grid}` : undefined }}>
            {showLabels && pct >= 12 && height >= 18 && (
              <span className="text-[11px] font-semibold" style={{ color: s.color === T.ausente || s.color === T.abst ? T.ink : '#fff' }}>
                {s.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Colunas empilhadas por mês ──────────────────────────────────────────────

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${MES[m - 1]}/${String(y).slice(2)}`;
}

/** Últimos 12 meses, com os meses sem votação preenchidos com zero. */
export function fillMonths(data: { mes: string; aprovadas: number; rejeitadas: number }[]) {
  const map = new Map(data.map(d => [d.mes, d]));
  const now = new Date();
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(map.get(key) ?? { mes: key, aprovadas: 0, rejeitadas: 0 });
  }
  return out;
}

export function MonthlyColumns({ data, tip }: {
  data: { mes: string; aprovadas: number; rejeitadas: number }[]; tip: ReturnType<typeof useTip>;
}) {
  const H = 180, BAR = 22;
  const max = Math.max(1, ...data.map(d => d.aprovadas + d.rejeitadas));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const y = (v: number) => H - (v / top) * H;

  return (
    <div className="flex gap-2">
      <div className="relative flex-shrink-0 text-[11px]" style={{ height: H, width: 22, color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
        {ticks.map(t => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: y(t) }}>{t}</span>)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="relative" style={{ height: H }}>
          {ticks.map(t => <div key={t} className="absolute left-0 right-0" style={{ top: y(t), height: 1, background: t ? T.grid : '#CBD5E1' }} />)}
          <div className="absolute inset-0 flex items-end">
            {data.map(d => {
              const tot = d.aprovadas + d.rejeitadas;
              const rows = [
                { label: 'aprovadas', value: String(d.aprovadas), color: T.sim },
                { label: 'rejeitadas', value: String(d.rejeitadas), color: T.nao },
              ];
              const label = monthLabel(d.mes);
              return (
                <div key={d.mes} className="flex-1 h-full flex flex-col items-center justify-end outline-none focus-visible:bg-slate-50"
                     tabIndex={tot ? 0 : -1}
                     onPointerMove={e => tot && tip.show(e, label, rows)} onPointerLeave={tip.hide}
                     onFocus={e => tot && tip.show(e, label, rows)} onBlur={tip.hide}
                     aria-label={`${label}: ${d.aprovadas} aprovadas, ${d.rejeitadas} rejeitadas`}>
                  {tot > 0 && <span className="text-[11px] font-semibold mb-1" style={{ color: T.ink2 }}>{tot}</span>}
                  {d.rejeitadas > 0 && (
                    <div style={{ width: BAR, maxWidth: '70%', height: (d.rejeitadas / top) * H - (d.aprovadas ? 2 : 0), background: T.nao,
                                  borderRadius: '4px 4px 0 0', marginBottom: d.aprovadas ? 2 : 0 }} />
                  )}
                  {d.aprovadas > 0 && (
                    <div style={{ width: BAR, maxWidth: '70%', height: (d.aprovadas / top) * H, background: T.sim,
                                  borderRadius: d.rejeitadas ? 0 : '4px 4px 0 0' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex mt-1.5">
          {data.map((d, i) => (
            <span key={d.mes} className="flex-1 text-center text-[10px] sm:text-[11px]" style={{ color: T.muted }}>
              {(data.length - 1 - i) % 2 === 0 || data.length <= 6 ? monthLabel(d.mes) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Avatar({ src, initials, size = 36 }: { src: string | null; initials: string | null; size?: number }) {
  return src
    /* eslint-disable-next-line @next/next/no-img-element */
    ? <img src={src} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
           style={{ width: size, height: size, background: T.accent, fontSize: size * 0.36 }}>{initials}</div>;
}
