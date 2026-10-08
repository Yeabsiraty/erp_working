import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api, qs } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { dateOf, num, useSubmit } from "../lib/forms.js";
import { fmt, fmt0, r2 } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import Period from "../components/Period.jsx";
import Icon from "../components/Icon.jsx";
import { Button, Card, ConfirmDelete, DateField, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Segmented, StatusPill } from "../components/ui.jsx";

const blankItem = () => ({ name: "", unit: t("ፍሬ"), buy: "", sell: "", init: 0, low: 5 });
const blankBuy = () => ({ ...todayEth(), item: "", qty: "", price: "", supplier: "" });

export default function Stock() {
  const toast = useToast();
  const now = todayEth();
  const [tab, setTab] = useState("items");
  const [per, setPer] = useState({ y: now.y, m: 0 });
  const items = useResource("/items/");
  const buys = useResource(`/purchases/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null); // {kind, id, ...}
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));

  const reloadAll = () => { items.reload(); buys.reload(); };
  const save = async (e) => {
    e.preventDefault();
    const { kind, id, ...v } = form;
    let path; let body;
    if (kind === "item") {
      path = "/items/";
      body = { name: v.name.trim(), unit: v.unit.trim(), buy: num(v.buy), sell: num(v.sell), init: num(v.init), low: num(v.low) };
    } else {
      path = "/purchases/";
      body = { y: num(v.y), m: num(v.m), d: num(v.d), item: v.item, qty: num(v.qty), price: num(v.price), supplier: v.supplier };
    }
    const ok = await run(() => (id ? api.put(`${path}${id}/`, body) : api.post(path, body)));
    if (ok) { setForm(null); reloadAll(); }
  };
  const remove = async (path, id) => {
    try { await api.del(`${path}${id}/`); toast(t("ተሰርዟል"), "del"); reloadAll(); } catch (e) { toast(e.message, "err"); }
  };

  const list = items.data || [];
  const stockValue = list.reduce((s, i) => s + i.value, 0);
  const pickBuyItem = (id) => {
    const it = list.find((i) => i.id === Number(id));
    set({ item: id === "" ? "" : Number(id), ...(it && !form.id ? { price: it.buy } : {}) });
  };

  return (
    <>
      <PageHeader title={t("ክምችት")} subtitle={t("{n} ዕቃዎች · ዋጋ {v} ብር", { n: list.length, v: fmt(stockValue) })}>
        {tab === "buys" && <Period value={per} onChange={setPer} />}
        <Button icon="plus" onClick={() => setForm(tab === "items" ? { kind: "item", ...blankItem() } : { kind: "buy", ...blankBuy() })}>
          {tab === "items" ? t("አዲስ ዕቃ") : t("ግዢ መዝግብ")}
        </Button>
      </PageHeader>
      <div className="tabs">
        <Segmented value={tab} onChange={setTab} options={[{ value: "items", label: t("ዕቃዎች") }, { value: "buys", label: t("ግዢዎች") }]} />
      </div>
      <ErrorNote error={items.error || buys.error} retry={reloadAll} />

      {tab === "items" ? (
        <Card flush>
          {items.loading && !items.data ? <Loading /> : list.length === 0 ? <Empty>{t("ገና ዕቃ አልተመዘገበም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ዕቃ")}</th><th className="num">{t("ቀሪ")}</th><th>{t("ሁኔታ")}</th><th className="num">{t("መግዣ")}</th><th className="num">{t("መሸጫ")}</th><th className="num">{t("የክምችት ዋጋ")}</th><th /></tr></thead>
                <tbody>
                  {list.map((i) => (
                    <tr key={i.id}>
                      <td className="strong">{i.name}</td>
                      <td className="num">{fmt0(i.left)} <span className="muted">{i.unit}</span></td>
                      <td><StatusPill status={i.status} /></td>
                      <td className="num">{fmt(i.buy)}</td>
                      <td className="num">{fmt(i.sell)}</td>
                      <td className="num">{fmt(i.value)}</td>
                      <td className="act">
                        <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => setForm({ kind: "item", id: i.id, name: i.name, unit: i.unit, buy: i.buy, sell: i.sell, init: i.init, low: i.low })}><Icon name="edit" size={17} /></button>
                        <ConfirmDelete onConfirm={() => remove("/items/", i.id)} />
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
          {buys.loading && !buys.data ? <Loading /> : (buys.data || []).length === 0 ? <Empty>{t("በዚህ ጊዜ ግዢ የለም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ቀን")}</th><th>{t("ዕቃ")}</th><th>{t("አቅራቢ")}</th><th className="num">{t("ብዛት")}</th><th className="num">{t("ዋጋ")}</th><th className="num">{t("ጠቅላላ")}</th><th /></tr></thead>
                <tbody>
                  {buys.data.map((b) => (
                    <tr key={b.id}>
                      <td className="muted">{dstr(b)}</td>
                      <td className="strong">{b.item_name}</td>
                      <td className="muted">{b.supplier || "—"}</td>
                      <td className="num">{fmt0(b.qty)}</td>
                      <td className="num">{fmt(b.price)}</td>
                      <td className="num strong">{fmt(b.total)}</td>
                      <td className="act">
                        <button className="icon-btn" aria-label={t("አስተካክል")} onClick={() => setForm({ kind: "buy", id: b.id, ...dateOf(b), item: b.item, qty: b.qty, price: b.price, supplier: b.supplier })}><Icon name="edit" size={17} /></button>
                        <ConfirmDelete onConfirm={() => remove("/purchases/", b.id)} />
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
        title={form?.kind === "item" ? (form.id ? t("ዕቃ አስተካክል") : t("አዲስ ዕቃ")) : form?.id ? t("ግዢ አስተካክል") : t("ግዢ መዝግብ")}>
        {form?.kind === "item" && (
          <form className="form" onSubmit={save}>
            <Field label={t("የዕቃ ስም")}><input value={form.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
            <div className="row2">
              <Field label={t("መለኪያ")}><input value={form.unit} onChange={(e) => set({ unit: e.target.value })} required /></Field>
              <Field label={t("ሊያልቅ ሲል ማስጠንቀቂያ")} hint={t("ቀሪው ከዚህ ሲያንስ")}><input type="number" step="any" min="0" value={form.low} onChange={(e) => set({ low: e.target.value })} /></Field>
            </div>
            <div className="row2">
              <Field label={t("መግዣ ዋጋ")}><input type="number" step="any" min="0" value={form.buy} onChange={(e) => set({ buy: e.target.value })} required /></Field>
              <Field label={t("መሸጫ ዋጋ")}><input type="number" step="any" min="0" value={form.sell} onChange={(e) => set({ sell: e.target.value })} required /></Field>
            </div>
            <Field label={t("መጀመሪያ ክምችት")}><input type="number" step="any" min="0" value={form.init} onChange={(e) => set({ init: e.target.value })} /></Field>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
        {form?.kind === "buy" && (
          <form className="form" onSubmit={save}>
            <DateField value={form} onChange={set} />
            <Field label={t("ዕቃ")}>
              <select value={form.item} onChange={(e) => pickBuyItem(e.target.value)} required>
                <option value="">{t("— ይምረጡ —")}</option>
                {list.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <div className="row2">
              <Field label={t("ብዛት")}><input type="number" step="any" min="0" value={form.qty} onChange={(e) => set({ qty: e.target.value })} required /></Field>
              <Field label={t("የአንዱ ዋጋ")}><input type="number" step="any" min="0" value={form.price} onChange={(e) => set({ price: e.target.value })} required /></Field>
            </div>
            <Field label={t("አቅራቢ")}><input value={form.supplier} onChange={(e) => set({ supplier: e.target.value })} /></Field>
            <div className="preview"><span>{t("ጠቅላላ")}</span><b>{fmt(r2(num(form.qty) * num(form.price)))} {t("ብር")}</b></div>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
      </Drawer>
    </>
  );
}
