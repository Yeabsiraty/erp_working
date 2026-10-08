import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import Icon from "../components/Icon.jsx";
import { Button, Card, ConfirmDelete, DateField, Drawer, Empty, ErrorNote, Field, Loading, PageHeader } from "../components/ui.jsx";

const cats = () => [t("ቤት ኪራይ"), t("ደመወዝ"), t("መብራት/ውሃ"), t("ትራንስፖርት"), t("ማስታወቂያ"), t("ጥገና"), t("ግብር"), t("ሌላ")];

export default function Expenses() {
  const toast = useToast();
  const now = todayEth();
  const [per, setPer] = useState({ y: now.y, m: now.m });
  const { data, loading, error, reload } = useResource(`/expenses/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const open = (r) => {
    setEditId(r?.id ?? null);
    setForm(r ? { ...dateOf(r), cat: r.cat, note: r.note, amount: r.amount } : { ...todayEth(), cat: "", note: "", amount: "" });
  };
  const save = async (e) => {
    e.preventDefault();
    const body = { y: num(form.y), m: num(form.m), d: num(form.d), cat: form.cat.trim(), note: form.note, amount: num(form.amount) };
    const ok = await run(() => (editId ? api.put(`/expenses/${editId}/`, body) : api.post("/expenses/", body)));
    if (ok) { setForm(null); reload(); }
  };
  const remove = async (id) => {
    try { await api.del(`/expenses/${id}/`); toast(t("ተሰርዟል"), "del"); reload(); } catch (e) { toast(e.message, "err"); }
  };
  const rows = data || [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <>
      <PageHeader title={t("ወጪ")} subtitle={t("{n} ግብይቶች · {v} ብር", { n: rows.length, v: fmt(total) })}>
        <Period value={per} onChange={setPer} />
        <Button icon="plus" onClick={() => open()}>{t("ወጪ መዝግብ")}</Button>
      </PageHeader>
      <ErrorNote error={error} retry={reload} />
      <Card flush>
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty>{t("በዚህ ጊዜ ወጪ የለም።")}</Empty> : (
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
                      <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => open(r)}><Icon name="edit" size={17} /></button>
                      <ConfirmDelete onConfirm={() => remove(r.id)} />
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
            <DateField value={form} onChange={set} />
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
