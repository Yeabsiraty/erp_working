const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

/** 1,234.50 */
export const fmt = (n) => money.format(Number(n) || 0);
/** 1,234.5 (ብዛት) */
export const fmt0 = (n) => plain.format(Number(n) || 0);
/** ወደ 2 አስርዮሽ ማጠጋጋት (ወደ ሰርቨር ከመላክ በፊት) */
export const r2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100;
export const r3 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 1000) / 1000;

/** ፕሮፎርማ ድምሮች — ከ Django ስሌት ጋር አንድ (በየመስመሩ r2፣ TOT r2) */
export function proformaTotals(items, rate) {
  const sub = items.reduce((s, i) => s + r2((Number(i.price) || 0) * (Number(i.qty) || 0)), 0);
  const tot = r2((sub * (Number(rate) || 0)) / 100);
  return { sub: r2(sub), tot, grand: r2(sub + tot) };
}

export const pid = (y, seq) => `PF-${y}-${String(seq).padStart(4, "0")}`;
