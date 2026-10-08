import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n.js";
import { fmt } from "../lib/format.js";

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** "ቆንጆ" የአክሲዮን ቁጥሮች (0, 500, 1k …) */
function niceScale(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

const short = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${+(v / 1e3).toFixed(1)}k`;
  return String(Math.round(v));
};

const H = 250;
const PAD = { t: 14, r: 10, b: 26, l: 44 };

function Frame({ width, scale, labels, children, onLeave }) {
  const iw = width - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const y = (v) => PAD.t + ih - ((v - scale.lo) / (scale.hi - scale.lo)) * ih;
  return (
    <svg width={width} height={H} role="img" onMouseLeave={onLeave} className="chart-svg">
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} className={t === 0 ? "ax0" : "grid"} />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{short(t)}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={PAD.l + (iw / labels.length) * (i + 0.5)} y={H - 8} textAnchor="middle" className="tick">{l}</text>
      ))}
      {children({ iw, ih, y })}
    </svg>
  );
}

function Tip({ title, rows }) {
  return (
    <div className="chart-tip">
      <b>{title}</b>
      {rows.map((r) => (
        <div key={r.name}><i style={{ background: r.color }} />{r.name}<span>{fmt(r.value)}</span></div>
      ))}
    </div>
  );
}

export function Legend({ series }) {
  return (
    <div className="legend">
      {series.map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
    </div>
  );
}

/** series: [{name, color, values:number[]}] */
export function BarChart({ labels, names, series }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));
  return (
    <div ref={ref} className="chart">
      <Frame width={width} scale={scale} labels={labels} onLeave={() => setHover(null)}>
        {({ iw, ih, y }) => {
          const band = iw / labels.length;
          const gap = Math.min(10, band * 0.22);
          const bw = Math.max(3, (band - gap) / series.length);
          return labels.map((_, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" />
              {hover === i && <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} className="hoverband" />}
              {series.map((s, k) => {
                const v = s.values[i];
                const x = PAD.l + band * i + gap / 2 + bw * k;
                const y0 = y(0), y1 = y(v);
                return (
                  <rect key={s.name} x={x} y={Math.min(y0, y1)} width={Math.max(2, bw - 2)}
                    height={Math.max(v === 0 ? 0 : 1.5, Math.abs(y0 - y1))} rx="2.5" fill={s.color} />
                );
              })}
            </g>
          ));
        }}
      </Frame>
      {hover != null && (
        <Tip title={names[hover]} rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />
      )}
    </div>
  );
}

export function LineChart({ labels, names, series }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const all = series.flatMap((s) => s.values);
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all));
  return (
    <div ref={ref} className="chart">
      <Frame width={width} scale={scale} labels={labels} onLeave={() => setHover(null)}>
        {({ iw, ih, y }) => {
          const band = iw / labels.length;
          const cx = (i) => PAD.l + band * (i + 0.5);
          return (
            <>
              {hover != null && <line x1={cx(hover)} x2={cx(hover)} y1={PAD.t} y2={PAD.t + ih} className="hoverline" />}
              {series.map((s) => (
                <g key={s.name}>
                  <path d={s.values.map((v, i) => `${i ? "L" : "M"}${cx(i)},${y(v)}`).join(" ")}
                    fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  {hover != null && <circle cx={cx(hover)} cy={y(s.values[hover])} r="4" fill={s.color} className="dot" />}
                </g>
              ))}
              {labels.map((_, i) => (
                <rect key={i} x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent"
                  onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              ))}
            </>
          );
        }}
      </Frame>
      {hover != null && (
        <Tip title={names[hover]} rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />
      )}
    </div>
  );
}
