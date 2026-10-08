import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import Icon from "../components/Icon.jsx";
import { Button, Card, ConfirmDelete, DateField, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Pill, Segmented } from "../components/ui.jsx";

export default function Debts() {
  const toast = useToast();
  const now = todayEth();
  const [tab, setTab] = useState("customers");
  const [per, setPer] = useState({ y: now.y, m: 0 });
  const customers = useResource("/customers/");
  const pays = useResource(`/payments/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null);
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const reloadAll = () => { customers.reload(); pays.reload(); };

  const save = async (e) => {
    e.preventDefault();
    const { kind, id, ...v } = form;
    const path = kind === "cust" ? "/customers/" : "/payments/";
    const body = kind === "cust"
      ? { name: v.name.trim(), phone: v.phone }
      : { y: num(v.y), m: num(v.m), d: num(v.d), customer: v.customer, amount: num(v.amount), note: v.note };
    const ok = await run(() => (id ? api.put(`${path}${id}/`, body) : api.post(path, body)));
    if (ok) { setForm(null); reloadAll(); }
  };
  const remove = async (path, id) => {
    try { await api.del(`${path}${id}/`); toast(t("ተሰርዟል"), "del"); reloadAll(); } catch (e) { toast(e.message, "err"); }
  };

  const list = customers.data || [];
  const total = list.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const owing = list.filter((c) => c.balance > 0);
  const openPay = (c) => setForm({ kind: "pay", ...todayEth(), customer: c?.id ?? "", amount: c && c.balance > 0 ? c.balance : "", note: "" });

  return (
    <>
      <PageHeader title={t("ዕዳ")} subtitle={t("{n} ተበዳሪዎች · {v} ብር ይቀራል", { n: owing.length, v: fmt(total) })}>
        {tab === "pays" && <Period value={per} onChange={setPer} />}
        {tab === "customers"
          ? <Button icon="plus" onClick={() => setForm({ kind: "cust", name: "", phone: "" })}>{t("አዲስ ደንበኛ")}</Button>
          : <Button icon="plus" onClick={() => openPay()}>{t("ክፍያ መዝግብ")}</Button>}
      </PageHeader>
      <div className="tabs">
        <Segmented value={tab} onChange={setTab} options={[{ value: "customers", label: t("ደንበኞች") }, { value: "pays", label: t("ክፍያዎች") }]} />
      </div>
      <ErrorNote error={customers.error || pays.error} retry={reloadAll} />

      {tab === "customers" ? (
        <Card flush>
          {customers.loading && !customers.data ? <Loading /> : list.length === 0 ? <Empty>{t("ገና ደንበኛ አልተመዘገበም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ደንበኛ")}</th><th>{t("ስልክ")}</th><th className="num">{t("ዱቤ")}</th><th className="num">{t("የተከፈለ")}</th><th className="num">{t("ቀሪ")}</th><th /></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td className="strong">{c.name}</td>
                      <td className="muted">{c.phone || "—"}</td>
                      <td className="num">{fmt(c.credit)}</td>
                      <td className="num">{fmt(c.upfront + c.paid)}</td>
                      <td className="num">{c.balance > 0 ? <Pill tone="bad">{fmt(c.balance)}</Pill> : <Pill tone="ok">{t("ተከፍሏል")}</Pill>}</td>
                      <td className="act">
                        {c.balance > 0 && <Button size="sm" variant="ghost" onClick={() => openPay(c)}>{t("ክፍያ")}</Button>}
                        <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => setForm({ kind: "cust", id: c.id, name: c.name, phone: c.phone })}><Icon name="edit" size={17} /></button>
                        <ConfirmDelete onConfirm={() => remove("/customers/", c.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card flush>
          {pays.loading && !pays.data ? <Loading /> : (pays.data || []).length === 0 ? <Empty>{t("በዚህ ጊዜ ክፍያ የለም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ቀን")}</th><th>{t("ደንበኛ")}</th><th>{t("ማስታወሻ")}</th><th className="num">{t("መጠን")}</th><th /></tr></thead>
                <tbody>
                  {pays.data.map((p) => (
                    <tr key={p.id}>
                      <td className="muted">{dstr(p)}</td>
                      <td className="strong">{p.customer_name}</td>
                      <td className="muted">{p.note || "—"}</td>
                      <td className="num strong pos">{fmt(p.amount)}</td>
                      <td className="act">
                        <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => setForm({ kind: "pay", id: p.id, ...dateOf(p), customer: p.customer, amount: p.amount, note: p.note })}><Icon name="edit" size={17} /></button>
                        <ConfirmDelete onConfirm={() => remove("/payments/", p.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Drawer open={!!form} onClose={() => setForm(null)}
        title={form?.kind === "cust" ? (form.id ? t("ደንበኛ አስተካክል") : t("አዲስ ደንበኛ")) : form?.id ? t("ክፍያ አስተካክል") : t("ክፍያ መዝግብ")}>
        {form?.kind === "cust" && (
          <form className="form" onSubmit={save}>
            <Field label={t("ስም")}><input value={form.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
            <Field label={t("ስልክ")}>
  <input
    type="tel"
    inputMode="numeric"
    pattern="[0-9]{10}"
    maxLength={10}
    value={form.phone}
    onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
  />
</Field>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
        {form?.kind === "pay" && (
          <form className="form" onSubmit={save}>
            <DateField value={form} onChange={set} />
            <Field label={t("ደንበኛ")}>
              <select value={form.customer} onChange={(e) => set({ customer: e.target.value ? Number(e.target.value) : "" })} required>
                <option value="">{t("— ይምረጡ —")}</option>
                {list.map((c) => <option key={c.id} value={c.id}>{c.name}{c.balance > 0 ? ` · ${fmt(c.balance)}` : ""}</option>)}
              </select>
            </Field>
            <Field label={t("የተከፈለ መጠን")}><input type="number" step="any" min="0" value={form.amount} onChange={(e) => set({ amount: e.target.value })} required /></Field>
            <Field label={t("ማስታወሻ")}><input value={form.note} onChange={(e) => set({ note: e.target.value })} /></Field>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
      </Drawer>
    </>
  );
}
