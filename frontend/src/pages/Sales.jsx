import { useState } from "react";
import { t } from "../lib/i18n.js";
import { bi } from "../lib/bi.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt, fmt0, r2 } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import SmartDateField from "../components/SmartDateField.jsx";
import { GuardedDelete, GuardedEdit, withAt } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";
import { Button, Card, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Pill, Segmented } from "../components/ui.jsx";

const blank = () => ({ ...todayEth(), item: "", qty: "", price: "", type: "cash", customer: "", paid: "", note: "" });

export default function Sales() {
  const toast = useToast();
  const now = todayEth();
  const [per, setPer] = useState({ y: now.y, m: now.m });
  const sales = useResource(`/sales/${qs({ y: per.y, m: per.m || "" })}`);
  const items = useResource("/items/");
  const customers = useResource("/customers/");
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [grant, setGrant] = useState(null);   // ለማስተካከል የተረጋገጠ token
  const [orig, setOrig] = useState(null);
  const [busy, run] = useSubmit();

  const [search, setSearch] = useState("");
 
  const [typeF, setTypeF] = useState("all");
  const [payF, setPayF] = useState("all");

  const open = (row, token) => {
    setEditId(row?.id ?? null);
    setGrant(token || null);
    setOrig(row ? { item: row.item, qty: Number(row.qty) } : null);
    setForm(row ? { ...dateOf(row), item: row.item, qty: row.qty, price: row.price, type: row.type, customer: row.customer ?? "", paid: row.paid || "", note: row.note || "" } : blank());
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
      note: (form.note || "").trim(),
    };
    const ok = await run(() => (editId ? api.put(withAt(`/sales/${editId}/`, grant), body) : api.post("/sales/", body)), undefined, editId ? "edit" : "ok");
    if (ok) { setForm(null); sales.reload(); items.reload(); customers.reload(); }
  };
  const remove = async (id, token) => {
    try { await api.del(withAt(`/sales/${id}/`, token)); toast(t("ተሰርዟል"), "del"); sales.reload(); items.reload(); customers.reload(); } catch (e) { toast(e.message, "err"); }
  };

  const all = sales.data || [];
  const isPaid = (r) => r.type !== "credit" || r.settled;
  const rows = all.filter((r) => {
    if (typeF !== "all" && r.type !== typeF) return false;
    if (payF === "paid" && !isPaid(r)) return false;
    if (payF === "unpaid" && isPaid(r)) return false;
     return hit(search, r.item_name, r.customer_name, r.type === "credit" ? t("ዱቤ") : t("ጥሬ"), r.type);
  });
  const filtering = !!search || typeF !== "all" || payF !== "all";
  const resetFilters = () => { setSearch(""); setTypeF("all"); setPayF("all"); };

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

      <Toolbar active={filtering} onReset={resetFilters}>
        <SearchBar value={search} onChange={setSearch} placeholder={bi("ዕቃ ወይም ደንበኛ ፈልግ…", "Search item or customer…")} />
        <FilterSelect label={t("አይነት")} value={typeF} onChange={setTypeF} options={[
          ALL(), { value: "cash", label: t("ጥሬ") }, { value: "credit", label: t("ዱቤ") },
        ]} />
        <FilterSelect label={bi("ክፍያ", "Payment")} value={payF} onChange={setPayF} options={[
          ALL(), { value: "paid", label: t("የተከፈለ") }, { value: "unpaid", label: bi("ያልተከፈለ", "Unpaid") },
        ]} />
      </Toolbar>

      <Card flush>
        {sales.loading && !sales.data ? <Loading /> : rows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("በዚህ ጊዜ ሽያጭ የለም።")}</Empty> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>{t("ቀን")}</th><th>{t("ዕቃ")}</th><th className="num">{t("ብዛት")}</th><th className="num">{t("ዋጋ")}</th><th className="num">{t("ጠቅላላ")}</th><th className="num">{t("ትርፍ")}</th><th>{t("አይነት")}</th><th>{t("ማስታወሻ")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const settled = r.type === "credit" && r.settled;
                  return (
                    <tr key={r.id} className={settled ? "row-paid" : undefined}>
                      <td className="muted">{dstr(r)}</td>
                      <td className="strong">{r.item_name}</td>
                      <td className="num">{fmt0(r.qty)}</td>
                      <td className="num">{fmt(r.price)}</td>
                      <td className="num strong">{fmt(r.total)}</td>
                      <td className={`num ${r.profit < 0 ? "neg" : "pos"}`}>{fmt(r.profit)}</td>
                      <td>
                        {r.type !== "credit"
                          ? <Pill tone="ok">{t("ጥሬ")}</Pill>
                          : settled
                            ? <Pill tone="ok">{t("የተከፈለ")} · {r.customer_name}</Pill>
                            : <Pill tone="warn">{t("ዱቤ")} · {r.customer_name}</Pill>}
                      </td>
                      <td>
                        <div className="note-cell" title={r.note || undefined}>{r.note || <span className="muted">—</span>}</div>
                      </td>
                      <td className="act">
                        {!settled && (
                          <>
                            <GuardedEdit onGranted={(tok) => open(r, tok)} />
                            <GuardedDelete onConfirm={(tok) => remove(r.id, tok)} />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr><td colSpan={4}>{t("ድምር")}</td><td className="num">{fmt(sum.total)}</td><td className="num">{fmt(sum.profit)}</td><td colSpan={3} /></tr></tfoot>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={!!form} title={editId ? t("ሽያጭ አስተካክል") : t("አዲስ ሽያጭ")} onClose={() => setForm(null)}>
        {form && (
          <form className="form" onSubmit={submit}>
            <SmartDateField value={form} onChange={(d) => set(d)} />
            <Field label={t("ዕቃ")} hint={left != null ? t("በክምችት ያለ፦ {v}", { v: fmt0(left) }) : undefined}>
              <select value={form.item} onChange={(e) => pickItem(e.target.value)} required>
                <option value="">{t("— ይምረጡ —")}</option>
                {(items.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <div className="row2">
              <Field label={t("ብዛት")}>
                <input type="number" step="any" min="0" max={left ?? undefined} value={form.qty} disabled={form.item === ""}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (left != null && Number(v) > left) v = String(left);
                    set({ qty: v });
                  }} required />
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
           <Field label={t("ማስታወሻ")} hint={`${(form.note || "").length}/500`}>
              <textarea rows={3} maxLength={500} value={form.note || ""} onChange={(e) => set({ note: e.target.value })} />
            </Field>
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