import { useState } from "react";
import { t } from "../lib/i18n.js";
import { bi } from "../lib/bi.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import SmartDateField from "../components/SmartDateField.jsx";
import { GuardedDelete, GuardedEdit, withAt } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";
import { Button, Card, Drawer, Empty, ErrorNote, Field, Loading, PageHeader } from "../components/ui.jsx";

const cats = () => [t("ቤት ኪራይ"), t("ደመወዝ"), t("መብራት/ውሃ"), t("ትራንስፖርት"), t("ማስታወቂያ"), t("ጥገና"), t("ግብር"), t("ሌላ")];

export default function Expenses() {
  const toast = useToast();
  const now = todayEth();
  const [per, setPer] = useState({ y: now.y, m: now.m });
  const { data, loading, error, reload } = useResource(`/expenses/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [grant, setGrant] = useState(null);
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const [search, setSearch] = useState("");
 
  const [catF, setCatF] = useState("all");

  const open = (r, token) => {
    setEditId(r?.id ?? null);
    setGrant(token || null);
    setForm(r ? { ...dateOf(r), cat: r.cat, note: r.note, amount: r.amount } : { ...todayEth(), cat: "", note: "", amount: "" });
  };
  const save = async (e) => {
    e.preventDefault();
    const body = { y: num(form.y), m: num(form.m), d: num(form.d), cat: form.cat.trim(), note: form.note, amount: num(form.amount) };
    const ok = await run(() => (editId ? api.put(withAt(`/expenses/${editId}/`, grant), body) : api.post("/expenses/", body)));
    if (ok) { setForm(null); reload(); }
  };
  const remove = async (id, token) => {
    try { await api.del(withAt(`/expenses/${id}/`, token)); toast(t("ተሰርዟል"), "del"); reload(); } catch (e) { toast(e.message, "err"); }
  };

  const all = data || [];
  const catList = [...new Set(all.map((r) => r.cat))].sort();
  const rows = all.filter((r) => {
    if (catF !== "all" && r.cat !== catF) return false;
    return hit(search, r.note);
  });
  const filtering = !!search || catF !== "all";
  const resetFilters = () => { setSearch(""); setCatF("all"); };
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader title={t("ወጪ")} subtitle={t("{n} ግብይቶች · {v} ብር", { n: rows.length, v: fmt(total) })}>
        <Period value={per} onChange={setPer} />
        <Button icon="plus" onClick={() => open()}>{t("ወጪ መዝግብ")}</Button>
      </PageHeader>
      <ErrorNote error={error} retry={reload} />

      <Toolbar active={filtering} onReset={resetFilters}>
        <SearchBar value={search} onChange={setSearch} placeholder={bi("በማስታወሻ ፈልግ…", "Search notes…")} />
        <FilterSelect label={t("ዓይነት")} value={catF} onChange={setCatF} options={[
          ALL(), ...catList.map((c) => ({ value: c, label: c })),
        ]} />
      </Toolbar>

      <Card flush>
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("በዚህ ጊዜ ወጪ የለም።")}</Empty> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t("ቀን")}</th><th>{t("ዓይነት")}</th><th>{t("ማስታወሻ")}</th><th className="num">{t("መጠን")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{dstr(r)}</td>
                    <td className="strong">{r.cat}</td>
                    <td className="muted">{r.note || "—"}</td>
                    <td className="num strong">{fmt(r.amount)}</td>
                    <td className="act">
                      <GuardedEdit onGranted={(tok) => open(r, tok)} />
                      <GuardedDelete onConfirm={(tok) => remove(r.id, tok)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={3}>{t("ድምር")}</td><td className="num">{fmt(total)}</td><td /></tr></tfoot>
            </table>
          </div>
        )}
      </Card>
      <Drawer open={!!form} title={editId ? t("ወጪ አስተካክል") : t("ወጪ መዝግብ")} onClose={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={save}>
            <SmartDateField value={form} onChange={set} />
            <Field label={t("የወጪ ዓይነት")}>
              <input list="cats" value={form.cat} onChange={(e) => set({ cat: e.target.value })} required />
              <datalist id="cats">{cats().map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label={t("መጠን")}><input type="number" step="any" min="0" value={form.amount} onChange={(e) => set({ amount: e.target.value })} required /></Field>
            <Field label={t("ማስታወሻ")}><input value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
      </Drawer>
    </>
  );
}