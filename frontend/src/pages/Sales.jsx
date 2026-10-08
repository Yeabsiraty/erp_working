import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt, fmt0, r2 } from "../lib/format.js";
import { useResource } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import { Button, Card, ConfirmDelete, DateField, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Pill, Segmented } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { useToast } from "../lib/hooks.jsx";

const blank = () => ({ ...todayEth(), item: "", qty: "", price: "", type: "cash", customer: "", paid: "" });

export default function Sales() {
  const toast = useToast();
  const now = todayEth();
  const [per, setPer] = useState({ y: now.y, m: now.m });
  const sales = useResource(`/sales/${qs({ y: per.y, m: per.m || "" })}`);
  const items = useResource("/items/");
  const customers = useResource("/customers/");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [orig, setOrig] = useState(null);
  const [busy, run] = useSubmit();

  const open = (row) => {
    setEditId(row?.id ?? null);
    setOrig(row ? { item: row.item, qty: Number(row.qty) } : null);
    setForm(row ? { ...dateOf(row), item: row.item, qty: row.qty, price: row.price, type: row.type, customer: row.customer ?? "", paid: row.paid || "" } : blank());
  };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const pickItem = (id) => {
    const it = items.data?.find((i) => i.id === Number(id));
    set({ item: id === "" ? "" : Number(id), qty: "", ...(it && !editId ? { price: it.sell } : {}) });
  };
  const total = r2(num(form?.qty) * num(form?.price));
  const submit = async (e) => {
    e.preventDefault();
    const body = {
      y: num(form.y), m: num(form.m), d: num(form.d), item: form.item, qty: num(form.qty), price: num(form.price),
      type: form.type, customer: form.type === "credit" ? form.customer || null : null, paid: form.type === "credit" ? num(form.paid) : 0,
    };
    const ok = await run(() => (editId ? api.put(`/sales/${editId}/`, body) : api.post("/sales/", body)), undefined, editId ? "edit" : "ok");
    if (ok) { setForm(null); sales.reload(); items.reload(); customers.reload(); }
  };
  const remove = async (id) => {
    try { await api.del(`/sales/${id}/`); toast(t("ተሰርዟል"), "del"); sales.reload(); items.reload(); customers.reload(); } catch (e) { toast(e.message, "err"); }
  };

  const rows = sales.data || [];
  const sum = rows.reduce((a, r) => ({ total: a.total + r.total, profit: a.profit + r.profit }), { total: 0, profit: 0 });
  const stockLeft = items.data?.find((i) => i.id === form?.item)?.left;
  const left = stockLeft == null ? null : Number(stockLeft) + (orig && orig.item === form?.item ? orig.qty : 0);

  return (
    <>
      <PageHeader title={t("ሽያጭ")} subtitle={t("{n} ግብይቶች · {v} ብር", { n: rows.length, v: fmt(sum.total) })}>
        <Period value={per} onChange={setPer} />
        <Button icon="plus" onClick={() => open()}>{t("አዲስ ሽያጭ")}</Button>
      </PageHeader>
      <ErrorNote error={sales.error} retry={sales.reload} />
      <Card flush>
        {sales.loading && !sales.data ? <Loading /> : rows.length === 0 ? <Empty>{t("በዚህ ጊዜ ሽያጭ የለም።")}</Empty> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t("ቀን")}</th><th>{t("ዕቃ")}</th><th className="num">{t("ብዛት")}</th><th className="num">{t("ዋጋ")}</th><th className="num">{t("ጠቅላላ")}</th><th className="num">{t("ትርፍ")}</th><th>{t("አይነት")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{dstr(r)}</td>
                    <td className="strong">{r.item_name}</td>
                    <td className="num">{fmt0(r.qty)}</td>
                    <td className="num">{fmt(r.price)}</td>
                    <td className="num strong">{fmt(r.total)}</td>
                    <td className={`num ${r.profit < 0 ? "neg" : "pos"}`}>{fmt(r.profit)}</td>
                    <td>{r.type === "credit" ? <Pill tone="warn">{t("ዱቤ")} · {r.customer_name}</Pill> : <Pill tone="ok">{t("ጥሬ")}</Pill>}</td>
                    <td className="act">
                      <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => open(r)}><Icon name="edit" size={17} /></button>
                      <ConfirmDelete onConfirm={() => remove(r.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={4}>{t("ድምር")}</td><td className="num">{fmt(sum.total)}</td><td className="num">{fmt(sum.profit)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={!!form} title={editId ? t("ሽያጭ አስተካክል") : t("አዲስ ሽያጭ")} onClose={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={submit}>
            <DateField value={form} onChange={(d) => set(d)} />
            <Field label={t("ዕቃ")} hint={left != null ? t("በክምችት ያለ፦ {v}", { v: fmt0(left) }) : undefined}>
              <select value={form.item} onChange={(e) => pickItem(e.target.value)} required>
                <option value="">{t("— ይምረጡ —")}</option>
                {(items.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <div className="row2">
              <Field label={t("ብዛት")}>
  <input
    type="number" step="any" min="0" max={left ?? undefined}
    value={form.qty}
    disabled={form.item === ""}
    onChange={(e) => {
      let v = e.target.value;
      if (left != null && Number(v) > left) v = String(left);
      set({ qty: v });
    }}
    required
  />
</Field>
              <Field label={t("የአንዱ ዋጋ")}><input type="number" step="any" min="0" value={form.price} onChange={(e) => set({ price: e.target.value })} required /></Field>
            </div>
            <Segmented value={form.type} onChange={(type) => set({ type })} options={[{ value: "cash", label: t("ጥሬ ገንዘብ") }, { value: "credit", label: t("ዱቤ") }]} />
            {form.type === "credit" && (
              <>
                <Field label={t("ደንበኛ")}>
                  <select value={form.customer} onChange={(e) => set({ customer: e.target.value ? Number(e.target.value) : "" })} required>
                    <option value="">{t("— ይምረጡ —")}</option>
                    {(customers.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label={t("ቅድመ ክፍያ")} hint={t("ዛሬ የተከፈለ ካለ")}><input type="number" step="any" min="0" value={form.paid} onChange={(e) => set({ paid: e.target.value })} /></Field>
              </>
            )}
            <div className="preview"><span>{t("ጠቅላላ")}</span><b>{fmt(total)} {t("ብር")}</b></div>
            <div className="form-actions">
              <Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button>
              <Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button>
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}
