import { bi } from "../lib/bi.js";

export const norm = (v) => String(v ?? "").toLowerCase().trim();
/** ከተሰጡት እሴቶች አንዱ q ን ከያዘ true (ባዶ q ሁሉንም ያሳልፋል) */
export const hit = (q, ...vals) => {
  const n = norm(q);
  return !n || vals.some((v) => norm(v).includes(n));
};
export const ALL = () => ({ value: "all", label: bi("ሁሉም", "All") });

const SearchIc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
);

export function Toolbar({ children, active, onReset }) {
  return (
    <div className="list-tools no-print">
      {children}
      {active && <button type="button" className="lt-reset" onClick={onReset}>{bi("ማጣሪያ አጽዳ", "Clear filters")}</button>}
    </div>
  );
}

/** fields=[{value,label}] ከሰጡ "በምን ፈልግ" መምረጫ ይታያል */
/** ቀላል የጽሑፍ መፈለጊያ — ሲጻፍ ወዲያውኑ ይፈልጋል (Enter አያስፈልግም) */
export function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="lt-search">
      <SearchIc />
      <input type="search" value={value} autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || bi("ፈልግ…", "Search…")} aria-label={bi("ፈልግ", "Search")} />
      {value && (
        <button type="button" className="lt-clear" onClick={() => onChange("")} aria-label={bi("አጽዳ", "Clear")}>×</button>
      )}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="lt-filter">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}