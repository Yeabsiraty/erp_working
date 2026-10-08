import { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n.js";
import Icon from "./Icon.jsx";
import { MONTHS, dateError, maxDay } from "../lib/ethiopian.js";

export function Button({ variant = "primary", size, icon, children, className = "", ...rest }) {
  return (
    <button className={`btn ${variant} ${size || ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="sub">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export const Card = ({ title, aside, children, className = "", flush }) => (
  <section className={`card ${flush ? "flush" : ""} ${className}`}>
    {(title || aside) && (
      <div className="card-head">
        {title && <h3>{title}</h3>}
        {aside && <div className="card-aside">{aside}</div>}
      </div>
    )}
    {children}
  </section>
);

export const Empty = ({ children, action }) => (
  <div className="empty">
    <p>{children}</p>
    {action}
  </div>
);

export const Pill = ({ tone = "neutral", children }) => <span className={`pill ${tone}`}>{children}</span>;

export const StatusPill = ({ status }) =>
  status === "ok" ? <Pill tone="ok">{t("በቂ")}</Pill>
    : status === "low" ? <Pill tone="warn">{t("ሊያልቅ ነው")}</Pill>
    : <Pill tone="bad">{t("አልቋል")}</Pill>;

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span className="lbl">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** ሁለት-ደረጃ የመሰረዣ ቁልፍ */
export function ConfirmDelete({ onConfirm, label = t("ሰርዝ") }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <button className="btn danger sm" onClick={() => { setArmed(false); onConfirm(); }}>{t("እርግጠኛ ነዎት?")}</button>
  ) : (
    <button className="icon-btn" title={label} aria-label={label} onClick={() => setArmed(true)}>
      <Icon name="trash" size={17} />
    </button>
  );
}

/** ቀን / ወር / ዓ.ም መሙያ (የኢትዮጵያ አቆጣጠር) */
export function DateField({ value, onChange, label = t("ቀን") }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const err = dateError(value);
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className={`dategrp ${err ? "bad" : ""}`}>
        <input
          type="number" inputMode="numeric" min="1" max={maxDay(Number(value.y), Number(value.m))}
          value={value.d} onChange={(e) => set({ d: e.target.value })} aria-label={t("ቀን")} required
        />
        <select value={value.m} onChange={(e) => set({ m: Number(e.target.value) })} aria-label={t("ወር")}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input
          type="number" inputMode="numeric" min="1990" max="2100"
          value={value.y} onChange={(e) => set({ y: e.target.value })} aria-label={t("ዓ.ም")} required
        />
      </div>
      {err && <span className="hint err">{err}</span>}
    </div>
  );
}

/** ከጎን የሚከፈት (በስልክ ከታች) የቅጽ መስኮት */
export function Drawer({ open, title, onClose, children }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // always the latest, without re-triggering the effect

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => ref.current?.querySelector("input,select,textarea")?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]); // only when opened or closed
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t("ዝጋ")}><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}


export const Loading = () => <div className="loading"><span className="spinner" /></div>;

export const ErrorNote = ({ error, retry }) =>
  error ? (
    <div className="note err">
      <span>{error.message}</span>
      {retry && <button className="link" onClick={retry}>{t("እንደገና ሞክር")}</button>}
    </div>
  ) : null;
