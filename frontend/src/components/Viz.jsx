import { useId } from "react";
import { fmt } from "../lib/format.js";

export const compact = (n) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);

/** ↗ አረንጓዴ (ወደ ላይ) / ↘ ቀይ (ወደ ታች) + መቶኛ */
export function Trend({ value }) {
  if (value == null) return <span className="trend flat">—</span>;
  const up = value >= 0;
  return (
    <span className={`trend ${up ? "up" : "down"}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {up
          ? <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>
          : <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>}
      </svg>
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function Spark({ values, color = "#38bdf8", height = 34 }) {
  const id = useId().replace(/:/g, "");
  const v = (values || []).map(Number);
  if (v.length < 2) return null;
  const W = 100, H = height;
  const max = Math.max(...v, 1), min = Math.min(...v, 0), span = max - min || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * W, H - 3 - ((x - min) / span) * (H - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height, marginTop: "auto" }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** ትንሽ ባለ ቀለም KPI ሳጥን */
export function Kpi({ icon, label, value, unit, change, note, spark, tone = "t1", extra }) {
  return (
    <div className={`dk ${tone}`}>
      <div className="dk-top"><span className="dk-ic">{icon}</span><span className="dk-label">{label}</span></div>
      <div className="dk-val">{fmt(value)}{unit && <small>{unit}</small>}</div>
      <div className="dk-foot">
        {change !== undefined && <Trend value={change} />}
        {note && <span className="dk-note">{note}</span>}
        {extra}
      </div>
      {spark && <Spark values={spark} color="#ffffff" />}
    </div>
  );
}

export const Panel = ({ title, aside, children, className = "" }) => (
  <div className={`fx ${className}`}>
    <div className="fx-title"><span>{title}</span>{aside}</div>
    {children}
  </div>
);

export function Donut({ data, colors, center, sub, empty }) {
  const rows = data.map((d) => ({ ...d, v: Math.max(0, Number(d.value) || 0) }));
  const total = rows.reduce((a, r) => a + r.v, 0);
  if (!total) return <p className="muted">{empty}</p>;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42" className="donut-svg" role="img">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="rgba(148,163,184,.22)" strokeWidth="5" />
        {rows.map((r, i) => {
          const p = (r.v / total) * 100;
          const dash = Math.max(0, p - 0.6);
          const el = (
            <circle key={i} cx="21" cy="21" r="15.9155" fill="none" stroke={colors[i % colors.length]} strokeWidth="5"
              strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={25 - acc} />
          );
          acc += p;
          return el;
        })}
        {center != null && <text x="21" y="21.5" textAnchor="middle" className="donut-t">{center}</text>}
        {sub && <text x="21" y="26.5" textAnchor="middle" className="donut-s">{sub}</text>}
      </svg>
      <ul className="donut-legend">
        {rows.map((r, i) => (
          <li key={i}><i style={{ background: colors[i % colors.length] }} /><span>{r.name}</span><b>{((r.v / total) * 100).toFixed(0)}%</b></li>
        ))}
      </ul>
    </div>
  );
}

/** ደረጃ የያዘ ባር ዝርዝር */
export function Rank({ items, empty }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  return (
    <div className="rank">
      {items.map((it, idx) => (
        <div className="rank-row" key={`${it.label}-${idx}`}>
          <div className="rank-top"><span><em>{idx + 1}</em>{it.label}</span><b>{it.text}</b></div>
          <div className="rank-track"><i style={{ width: `${Math.max(3, (Number(it.value) / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}