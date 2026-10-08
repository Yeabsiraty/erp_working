// ሁለት ቋንቋ: አማርኛ (am) ↔ English (en).
// ቁልፉ ራሱ አማርኛው ጽሑፍ ነው፤ `t("ሽያጭ")` በ "am" ሲሆን እንዳለ ይመልሳል፣ በ "en" ሲሆን en.js ውስጥ ያለውን ትርጉም።
// {name} ያላቸው ጽሑፎች ዋጋ ይቀበላሉ: t("{n} ግብይቶች", { n: 5 })
import { applyEthLang } from "./ethiopian.js";
import EN from "./en.js";

const KEY = "ledger_lang";
let lang = "am";
try {
  const saved = localStorage.getItem(KEY);
  lang = saved === "en" || saved === "am" ? saved : (navigator.language || "").startsWith("en") ? "en" : "am";
} catch { /* ignore */ }
applyEthLang(lang);
document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(next) {
  lang = next;
  applyEthLang(next);
  document.documentElement.lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
}

export function t(am, vars) {
  let s = lang === "en" ? (EN[am] ?? am) : am;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
  return s;
}
