import { MONTHS } from "../lib/ethiopian.js";
import { t } from "../lib/i18n.js";

/** የዓመት + ወር ማጣሪያ (m=0 ማለት ሁሉም ወራት) */
export default function Period({ value, onChange }) {
  return (
    <div className="filters">
      <select aria-label={t("ወር")} value={value.m} onChange={(e) => onChange({ ...value, m: Number(e.target.value) })}>
        <option value={0}>{t("ሁሉም ወራት")}</option>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <input aria-label={t("ዓ.ም")} type="number" style={{ width: 92 }} value={value.y}
        onChange={(e) => onChange({ ...value, y: e.target.value })} />
    </div>
  );
}
