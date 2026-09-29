'use client';

import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/format';
import { Segmented } from '@/components/ui/misc';

interface Point {
  day: string; // YYYY-MM-DD (Dhaka)
  revenue: number;
  count: number;
}

const BAR = '#006cfa';
const BAR_DIM = '#b9d6fe';
const GRID = '#eef2f7';
const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 48 };

function niceMax(value: number) {
  if (value <= 0) return 1000;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function axisMoney(v: number) {
  if (v >= 100000) return `৳${+(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `৳${+(v / 1000).toFixed(1)}k`;
  return `৳${v}`;
}

const dayLabel = (d: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));

/** Single-series daily revenue columns with per-column hover tooltip and a table view. */
export function RevenueChart({ data }: { data: Point[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [view]);

  const max = niceMax(Math.max(...data.map((d) => d.revenue), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const innerW = Math.max(width - PAD.left - PAD.right, 0);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? innerW / data.length : 0;
  const barW = Math.min(24, band * 0.62);
  const labelEvery = band < 26 ? 3 : band < 44 ? 2 : 1;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const empty = data.every((d) => d.revenue === 0);

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const count = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">Revenue · last 14 days</p>
          <p className="mt-1 text-[28px] font-bold tracking-tight text-slate-900">{money(total)}</p>
          <p className="text-[12.5px] text-slate-500">{count} completed payment{count === 1 ? '' : 's'}</p>
        </div>
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </div>

      {view === 'table' ? (
        <div className="mt-5 max-h-[260px] overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-slate-50 text-left text-[12px] text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Day</th>
                <th className="px-3 py-2 text-right font-semibold">Payments</th>
                <th className="px-3 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="px-3 py-2 text-slate-700">{dayLabel(d.day)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d.count}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">{money(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrap} className="relative mt-4" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label={`Daily revenue for the last 14 days, total ${money(total)}`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[11px] tabular-nums">
                    {axisMoney(t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const cx = PAD.left + band * i + band / 2;
                const h = Math.max(PAD.top + innerH - y(d.revenue), d.revenue > 0 ? 3 : 0);
                const top = PAD.top + innerH - h;
                const r = Math.min(4, h, barW / 2);
                const x0 = cx - barW / 2;
                const path =
                  h > 0
                    ? `M${x0},${PAD.top + innerH} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${PAD.top + innerH} Z`
                    : '';
                return (
                  <g key={d.day}>
                    {path && <path d={path} fill={hover === null || hover === i ? BAR : BAR_DIM} className="transition-colors" />}
                    {i % labelEvery === (data.length - 1) % labelEvery && (
                      <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-400 text-[11px]">
                        {dayLabel(d.day)}
                      </text>
                    )}
                    {/* Hit target: the whole column band */}
                    <rect
                      x={PAD.left + band * i}
                      y={PAD.top}
                      width={band}
                      height={innerH}
                      fill="transparent"
                      onMouseEnter={() => setHover(i)}
                      onTouchStart={() => setHover(i)}
                    />
                  </g>
                );
              })}
              <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#e2e8f0" strokeWidth={1} />
            </svg>
          )}
          {empty && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center pb-6">
              <p className="rounded-lg bg-white/90 px-3 py-1.5 text-[13px] text-slate-500 shadow-card">No completed payments yet</p>
            </div>
          )}
          {hover !== null && data[hover] && (
            <div
              className="pointer-events-none absolute z-10 w-40 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lift"
              style={{
                left: Math.min(Math.max(PAD.left + band * hover + band / 2, 80), width - 80),
                top: Math.max(y(data[hover].revenue) - 72, 0),
              }}
            >
              <p className="text-[11.5px] font-medium text-slate-500">{dayLabel(data[hover].day)}</p>
              <p className="text-[15px] font-bold text-slate-900">{money(data[hover].revenue)}</p>
              <p className="text-[11.5px] text-slate-500">
                {data[hover].count} payment{data[hover].count === 1 ? '' : 's'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
