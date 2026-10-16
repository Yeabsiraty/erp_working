import { useEffect, useState } from "react";
import { t } from "../lib/i18n.js";
import { bi } from "../lib/bi.js";
import { api, setToken } from "../lib/api.js";
import { num, useSubmit } from "../lib/forms.js";
import { useLang, useSettings, useTheme, useToast } from "../lib/hooks.jsx";
import { askPassword, withAt } from "../components/Guard.jsx";
import { Button, Card, Field, PageHeader, Segmented } from "../components/ui.jsx";

export default function Settings() {
  const { settings, reload } = useSettings();
  const toast = useToast();
  const [theme, toggleTheme] = useTheme();
  const { lang, setLang } = useLang();
  const [f, setF] = useState(settings);
  const [busy, run] = useSubmit();
  useEffect(() => setF(settings), [settings]);
  if (!f) return null;
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const text = (key, label) => <Field label={label}><input value={f[key] ?? ""} onChange={(e) => set({ [key]: e.target.value })} /></Field>;

  const save = async (e) => {
    e.preventDefault();
    const tok = await askPassword("edit");        // password popup first
    if (!tok) return;                             // cancelled -> nothing is saved
    // wrong password is already rejected inside the popup; the server also checks the token
    if (await run(() => api.put(withAt("/settings/", tok), { ...f, tot_rate: num(f.tot_rate), vat_rate: num(f.vat_rate) }))) reload();
  };
  const demo = async (kind) => {
    try {
      if (kind === "load") await api.post("/demo/load/"); else await api.post("/demo/clear/");
      toast(kind === "load" ? t("የናሙና መረጃ ተጭኗል") : t("የናሙና መረጃ ተሰርዟል"));
    } catch (e) { toast(e.message, "err"); }
  };
  const logout = async () => {
    try { await api.post("/auth/logout/"); } catch { /* ignore */ }
    setToken(null);
    window.dispatchEvent(new Event("auth:logout"));
  };

  return (
    <>
      <PageHeader title={t("ቅንብር")} subtitle={t("የሱቅና የፕሮፎርማ መረጃ")} />
      <div className="stack">
        <form className="card form" onSubmit={save}>
          {text("name", t("የሱቅ ስም"))}
          <div className="row2">{text("title_am", t("ርዕስ (አማርኛ)"))}{text("title_en", t("ርዕስ (English)"))}</div>
          <div className="row2">{text("website", t("ድረ-ገጽ / ኢሜይል"))}{text("phone", t("ስልክ"))}</div>
          <div className="row2">{text("handle", "Handle")}{text("social", "Social media")}</div>
          <div className="row2">{text("signer", t("ፈራሚ"))}{text("signer_role", t("የፈራሚ ሥራ"))}</div>

          <span className="lbl muted" style={{ fontSize: 13, fontWeight: 600 }}>{bi("የአባሪ (Attachment) ነባሪ መረጃ", "Attachment defaults")}</span>
          <div className="row2">{text("att_bill_to", "Bill to")}{text("att_tin", "TIN")}</div>
          <div className="row2">{text("att_address", "Address")}{text("att_ref", "Ref.")}</div>
          <div className="row2">{text("att_fs_no", "FS. NO")}<span /></div>

          <Field label={t("ነባሪ VAT %")}><input type="number" step="any" min="0" max="100" value={f.tot_rate} onChange={(e) => set({ tot_rate: e.target.value })} /></Field>
          <div className="row2">
            <Field label={t("ነባሪ VAT %")}><input type="number" step="any" min="0" max="100" value={f.vat_rate} onChange={(e) => set({ vat_rate: e.target.value })} /></Field>
            <span />
          </div>
          <Field label={t("ነባሪ Terms (ፕሮፎርማ)")}><textarea value={f.terms ?? ""} onChange={(e) => set({ terms: e.target.value })} /></Field>
          <Field label={t("ነባሪ Terms (የክፍያ ጥያቄ)")}><textarea value={f.pr_terms ?? ""} onChange={(e) => set({ pr_terms: e.target.value })} /></Field>
          <div className="form-actions"><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
        </form>
        <Card title={t("ቋንቋ")}>
          <Segmented value={lang} onChange={setLang} options={[{ value: "am", label: "አማርኛ" }, { value: "en", label: "English" }]} />
        </Card>
        <Card title={t("ገጽታ")}>
          <Segmented value={theme} onChange={(v) => v !== theme && toggleTheme()} options={[{ value: "light", label: t("ብርሃን") }, { value: "dark", label: t("ጨለማ") }]} />
        </Card>
        <Card title={t("የናሙና መረጃ")}>
          <div className="page-actions">
            <Button variant="ghost" onClick={() => demo("load")}>{t("ናሙና ጫን")}</Button>
            <Button variant="danger" onClick={() => demo("clear")}>{t("ናሙና ሰርዝ")}</Button>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>{t("ናሙና የሚጫነው ደብተሩ ባዶ ሲሆን ብቻ ነው፤ መሰረዝ የናሙናውን ብቻ ያጠፋል። ገጹን ያድሱ።")}</p>
        </Card>
        <Card title={t("መለያ")}><Button variant="ghost" icon="logout" onClick={logout}>{t("ውጣ")}</Button></Card>
      </div>
    </>
  );
}