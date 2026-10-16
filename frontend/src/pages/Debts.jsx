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
import { GuardedDelete, GuardedEdit, askPassword, withAt } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";
import { Button, Card, Drawer, Empty, ErrorNote, Field, Loading, PageHeader, Pill, Segmented } from "../components/ui.jsx";

/** በረድፍ ላይ ሲያንዣብቡ የሚታየው ዝርዝር፦ ያልተከፈለ (ቀይ) ወይም የተከፈለ (አረንጓዴ) */
function DebtTip({ tip, details }) {
  if (!tip) return null;
  const { c, x, y } = tip;
  const unpaid = c.balance > 0;
  const d = details?.[c.id];
  const rows = (unpaid ? d?.unpaid : d?.settled) || [];
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const W = 290;
  const h = Math.min(340, 110 + rows.length * 30);
  const left = Math.max(8, Math.min(x + 16, window.innerWidth - W - 12));
  const top = y + 16 + h > window.innerHeight ? Math.max(8, y - h - 12) : y + 16;
  return (
    <div className={`debt-tip ${unpaid ? "unpaid" : "settled"}`} style={{ left, top, width: W }} role="tooltip">
      <div className="dt-name">{c.name}</div>
      <div className="dt-sub">{unpaid ? bi("ያልተከፈለ ዕዳ", "Unpaid debts") : bi("የተከፈለ ዕዳ", "Settled debts")}</div>
      <div className="dt-list">
        {rows.length === 0
          ? <div className="dt-empty">{d ? bi("ምንም የለም።", "Nothing to show.") : "…"}</div>
          : rows.map((r) => (
            <div className="dt-row" key={r.id}><b>{fmt(r.amount)}</b><span>{dstr(r)}</span></div>
          ))}
      </div>
      {rows.length > 0 && <div className="dt-total"><span>{t("ድምር")}</span><b>{fmt(total)}</b></div>}
    </div>
  );
}

export default function Debts() {
  const toast = useToast();
  const now = todayEth();
  const [tab, setTab] = useState("customers");
  const [per, setPer] = useState({ y: now.y, m: 0 });
  const customers = useResource("/customers/");
    const details = useResource("/customers/debt-details/");
  const [tip, setTip] = useState(null);
  const pays = useResource(`/payments/${qs({ y: per.y, m: per.m || "" })}`);
  const [form, setForm] = useState(null);
  const [grant, setGrant] = useState(null);
  const [busy, run] = useSubmit();
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const reloadAll = () => { customers.reload(); pays.reload(); details.reload(); };

  const [search, setSearch] = useState("");
 
  const [statusF, setStatusF] = useState("all");   // ደንበኞች: ሁሉም / ዕዳ ያለበት / የተከፈለ
  const [custF, setCustF] = useState("all");       // ክፍያዎች: ደንበኛ
  const switchTab = (v) => { setTab(v); setTip(null); setSearch(""); setStatusF("all"); setCustF("all"); };

  const save = async (e) => {
    e.preventDefault();
    const { kind, id, ...v } = form;
    const path = kind === "cust" ? "/customers/" : "/payments/";
    const body = kind === "cust"
      ? { name: v.name.trim(), phone: v.phone }
      : { y: num(v.y), m: num(v.m), d: num(v.d), customer: v.customer, amount: num(v.amount), note: v.note };
    const ok = await run(() => {
      if (id) return api.put(withAt(`${path}${id}/`, grant), body);
      return api.post(kind === "pay" ? withAt(path, grant) : path, body);  // new payment needs the password token
    });
    if (ok) { setForm(null); reloadAll(); }
  };
  const remove = async (path, id, token) => {
    try { await api.del(withAt(`${path}${id}/`, token)); toast(t("ተሰርዟል"), "del"); reloadAll(); } catch (e) { toast(e.message, "err"); }
  };

  const list = customers.data || [];
  const total = list.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const owing = list.filter((c) => c.balance > 0);
  const openPay = async (c) => {
    setTip(null);
    const tok = await askPassword("pay");   // wrong password: the server rejects it and the form never opens
    if (!tok) return;
    setGrant(tok);
    setForm({ kind: "pay", ...todayEth(), customer: c?.id ?? "", amount: c && c.balance > 0 ? c.balance : "", note: "" });
  };

  const custRows = list.filter((c) => {
    if (statusF === "owes" && !(c.balance > 0)) return false;
    if (statusF === "clear" && c.balance > 0) return false;
    return hit(search, c.name, c.phone);
  });
  const payRows = (pays.data || []).filter((p) => {
    if (custF !== "all" && String(p.customer) !== custF) return false;
    return hit(search, p.customer_name);
  });
  const filtering = !!search || statusF !== "all" || custF !== "all";
  const resetFilters = () => { setSearch(""); setStatusF("all"); setCustF("all"); };

  return (
    <>
      <PageHeader title={t("ዕዳ")} subtitle={t("{n} ተበዳሪዎች · {v} ብር ይቀራል", { n: owing.length, v: fmt(total) })}>
        {tab === "pays" && <Period value={per} onChange={setPer} />}
        {tab === "customers"
          ? <Button icon="plus" onClick={() => { setGrant(null); setForm({ kind: "cust", name: "", phone: "" }); }}>{t("አዲስ ደንበኛ")}</Button>
          : <Button icon="plus" onClick={() => openPay()}>{t("ክፍያ መዝግብ")}</Button>}
      </PageHeader>
      <div className="tabs">
        <Segmented value={tab} onChange={switchTab} options={[{ value: "customers", label: t("ደንበኞች") }, { value: "pays", label: t("ክፍያዎች") }]} />
      </div>
      <ErrorNote error={customers.error || pays.error} retry={reloadAll} />

           <Toolbar active={filtering} onReset={resetFilters}>
        {tab === "customers" ? (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder={bi("ስም ወይም ስልክ ፈልግ…", "Search name or phone…")} />
            <FilterSelect label={t("ሁኔታ")} value={statusF} onChange={setStatusF} options={[
              ALL(), { value: "owes", label: bi("ያልተከፈለ", "Unpaid") }, { value: "clear", label: t("የተከፈለ") },
            ]} />
          </>
        ) : (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder={bi("የደንበኛ ስም ፈልግ…", "Search customer name…")} />
            <FilterSelect label={t("ደንበኛ")} value={custF} onChange={setCustF} options={[
              ALL(), ...list.map((c) => ({ value: String(c.id), label: c.name })),
            ]} />
          </>
        )}
      </Toolbar>

      {tab === "customers" ? (
        <Card flush>
          {customers.loading && !customers.data ? <Loading /> : custRows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("ገና ደንበኛ አልተመዘገበም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ደንበኛ")}</th><th>{t("ስልክ")}</th><th className="num">{t("ዱቤ")}</th><th className="num">{t("የተከፈለ")}</th><th className="num">{t("ቀሪ")}</th><th /></tr></thead>
                <tbody>
                  {custRows.map((c) => (
                    <tr key={c.id}
                      onMouseEnter={(e) => setTip({ c, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTip(null)}>
                      <td className="strong">{c.name}</td>
                      <td className="muted">{c.phone || "—"}</td>
                      <td className="num">{fmt(c.credit)}</td>
                      <td className="num">{fmt(c.upfront + c.paid)}</td>
                      <td className="num">{c.balance > 0 ? <Pill tone="bad">{fmt(c.balance)}</Pill> : <Pill tone="ok">{t("ተከፍሏል")}</Pill>}</td>
                      <td className="act">
                        {c.balance > 0 && <Button size="sm" variant="ghost" onClick={() => openPay(c)}>{t("ክፍያ")}</Button>}
                        <GuardedEdit onGranted={(tok) => { setGrant(tok); setForm({ kind: "cust", id: c.id, name: c.name, phone: c.phone }); }} />
                        <GuardedDelete onConfirm={(tok) => remove("/customers/", c.id, tok)} />
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
          {pays.loading && !pays.data ? <Loading /> : payRows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("በዚህ ጊዜ ክፍያ የለም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>{t("ቀን")}</th><th>{t("ደንበኛ")}</th><th>{t("ማስታወሻ")}</th><th className="num">{t("መጠን")}</th><th /></tr></thead>
                <tbody>
                  {payRows.map((p) => (
                    <tr key={p.id}>
                      <td className="muted">{dstr(p)}</td>
                      <td className="strong">{p.customer_name}</td>
                      <td className="muted">{p.note || "—"}</td>
                      <td className="num strong pos">{fmt(p.amount)}</td>
                      <td className="act">
                        <GuardedEdit onGranted={(tok) => { setGrant(tok); setForm({ kind: "pay", id: p.id, ...dateOf(p), customer: p.customer, amount: p.amount, note: p.note }); }} />
                        <GuardedDelete onConfirm={(tok) => remove("/payments/", p.id, tok)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <DebtTip tip={tip} details={details.data} />
      <Drawer open={!!form} onClose={() => setForm(null)}
        title={form?.kind === "cust" ? (form.id ? t("ደንበኛ አስተካክል") : t("አዲስ ደንበኛ")) : form?.id ? t("ክፍያ አስተካክል") : t("ክፍያ መዝግብ")}>
        {form?.kind === "cust" && (
          <form className="form" onSubmit={save}>
            <Field label={t("ስም")}><input value={form.name} onChange={(e) => set({ name: e.target.value })} required /></Field>
            <Field label={t("ስልክ")}>
              <input type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={form.phone}
                onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
            </Field>
            <div className="form-actions"><Button variant="ghost" type="button" onClick={() => setForm(null)}>{t("ተው")}</Button><Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button></div>
          </form>
        )}
        {form?.kind === "pay" && (
          <form className="form" onSubmit={save}>
            <SmartDateField value={form} onChange={set} />
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