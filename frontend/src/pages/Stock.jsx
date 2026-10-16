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
import { Button, Card, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Segmented, StatusPill } from "../components/ui.jsx";

const blankItem = () => ({ name: "", unit: t("ፍሬ"), buy: "", sell: "", init: 0, low: 5 });
const blankBuy = () => ({ ...todayEth(), item: "", qty: "", price: "", supplier: "" });

export default function Stock() {
  const toast = useToast();
  const now = todayEth();
  const [tab, setTab] = useState("items");
  const [per, setPer] = useState({ y: now.y, m: 0 });
  const items = useResource("/items/");
  const buys = useResource(`/purchases/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null);
  const [grant, setGrant] = useState(null);
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const reloadAll = () => { items.reload(); buys.reload(); };

  const [search, setSearch] = useState("");
 
  const [statusF, setStatusF] = useState("all");
  const [itemF, setItemF] = useState("all");
  const switchTab = (v) => { setTab(v); setSearch(""); setStatusF("all"); setItemF("all"); };

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
    const ok = await run(() => {
      if (id) return api.put(withAt(`${path}${id}/`, grant), body);
      return api.post(kind === "pay" ? withAt(path, grant) : path, body);  // new payment needs the password token
    });
    if (ok) { setForm(null); reloadAll(); }
  };
  const remove = async (path, id, token) => {
    try { await api.del(withAt(`${path}${id}/`, token)); toast(t("ተሰርዟል"), "del"); reloadAll(); } catch (e) { toast(e.message, "err"); }
  };

  const list = items.data || [];
  const stockValue = list.reduce((s, i) => s + i.value, 0);
  const pickBuyItem = (id) => {
    const it = list.find((i) => i.id === Number(id));
    set({ item: id === "" ? "" : Number(id), ...(it && !form.id ? { price: it.buy } : {}) });
  };

  const itemRows = list.filter((i) => {
    if (statusF !== "all" && i.status !== statusF) return false;
    return hit(search, i.name);
  });
  const buyRows = (buys.data || []).filter((b) => {
    if (itemF !== "all" && String(b.item) !== itemF) return false;
    return hit(search, b.item_name);
  });
  const filtering = !!search || statusF !== "all" || itemF !== "all";
  const resetFilters = () => { setSearch(""); setStatusF("all"); setItemF("all"); };

  return (
    <>
      <PageHeader title={t("ክምችት")} subtitle={t("{n} ዕቃዎች · ዋጋ {v} ብር", { n: list.length, v: fmt(stockValue) })}>
        {tab === "buys" && <Period value={per} onChange={setPer} />}
        <Button icon="plus" onClick={() => { setGrant(null); setForm(tab === "items" ? { kind: "item", ...blankItem() } : { kind: "buy", ...blankBuy() }); }}>
          {tab === "items" ? t("አዲስ ዕቃ") : t("ግዢ መዝግብ")}
        </Button>
      </PageHeader>
      <div className="tabs">
        <Segmented value={tab} onChange={switchTab} options={[{ value: "items", label: t("ዕቃዎች") }, { value: "buys", label: t("ግዢዎች") }]} />
      </div>
      <ErrorNote error={items.error || buys.error} retry={reloadAll} />

            <Toolbar active={filtering} onReset={resetFilters}>
        {tab === "items" ? (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder={bi("የዕቃ ስም ፈልግ…", "Search item name…")} />
            <FilterSelect label={t("ሁኔታ")} value={statusF} onChange={setStatusF} options={[
              ALL(), { value: "ok", label: t("በቂ") }, { value: "low", label: t("ሊያልቅ ነው") }, { value: "out", label: t("አልቋል") },
            ]} />
          </>
        ) : (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder={bi("የዕቃ ስም ፈልግ…", "Search item name…")} />
            <FilterSelect label={t("ዕቃ")} value={itemF} onChange={setItemF} options={[
              ALL(), ...list.map((i) => ({ value: String(i.id), label: i.name })),
            ]} />
          </>
        )}
      </Toolbar>

      {tab === "items" ? (
        <Card flush>
          {items.loading && !items.data ? <Loading /> : itemRows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("ገና ዕቃ አልተመዘገበም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ዕቃ")}</th><th className="num">{t("ቀሪ")}</th><th>{t("ሁኔታ")}</th><th className="num">{t("መግዣ")}</th><th className="num">{t("መሸጫ")}</th><th className="num">{t("የክምችት ዋጋ")}</th><th /></tr></thead>
                <tbody>
                  {itemRows.map((i) => (
                    <tr key={i.id}>
                      <td className="strong">{i.name}</td>
                      <td className="num">{fmt0(i.left)} <span className="muted">{i.unit}</span></td>
                      <td><StatusPill status={i.status} /></td>
                      <td className="num">{fmt(i.buy)}</td>
                      <td className="num">{fmt(i.sell)}</td>
                      <td className="num">{fmt(i.value)}</td>
                      <td className="act">
                        <GuardedEdit onGranted={(tok) => { setGrant(tok); setForm({ kind: "item", id: i.id, name: i.name, unit: i.unit, buy: i.buy, sell: i.sell, init: i.init, low: i.low }); }} />
                        <GuardedDelete onConfirm={(tok) => remove("/items/", i.id, tok)} />
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
          {buys.loading && !buys.data ? <Loading /> : buyRows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("በዚህ ጊዜ ግዢ የለም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ቀን")}</th><th>{t("ዕቃ")}</th><th>{t("አቅራቢ")}</th><th className="num">{t("ብዛት")}</th><th className="num">{t("ዋጋ")}</th><th className="num">{t("ጠቅላላ")}</th><th /></tr></thead>
                <tbody>
                  {buyRows.map((b) => (
                    <tr key={b.id}>
                      <td className="muted">{dstr(b)}</td>
                      <td className="strong">{b.item_name}</td>
                      <td className="muted">{b.supplier || "—"}</td>
                      <td className="num">{fmt0(b.qty)}</td>
                      <td className="num">{fmt(b.price)}</td>
                      <td className="num strong">{fmt(b.total)}</td>
                      <td className="act">
                        <GuardedEdit onGranted={(tok) => { setGrant(tok); setForm({ kind: "buy", id: b.id, ...dateOf(b), item: b.item, qty: b.qty, price: b.price, supplier: b.supplier }); }} />
                        <GuardedDelete onConfirm={(tok) => remove("/purchases/", b.id, tok)} />
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
            <SmartDateField value={form} onChange={set} />
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