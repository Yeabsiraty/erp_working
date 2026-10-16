import { useEffect, useState } from "react";
import { t } from "../lib/i18n.js";
import { bi } from "../lib/bi.js";
import { api } from "../lib/api.js";
import { MONTHS, dstr, todayEth } from "../lib/ethiopian.js";
import { num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useMe } from "../lib/me.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import { BarChart, Legend, LineChart } from "../components/Charts.jsx";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHeader, Pill } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { Donut, Kpi, Panel, compact } from "../components/Viz.jsx";
import { NoAccess, Popup, UnlockGate, askPassword } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";

const GREEN = "#16a34a", ORANGE = "#f97316", RED = "#dc2626", BLUE = "#2563eb";
const btn = (bg) => ({ background: bg, color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 });
const signed = (v) => `${Number(v) > 0 ? "+" : ""}${fmt(v)}`;
const BLUES = ["#38bdf8", "#2563eb", "#22d3ee", "#818cf8"];

const DebtIn = ({ value }) => (
  <span className="debt-in" title={t("በዕዳ የገባ ገንዘብ")}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
    {fmt(value)}
  </span>
);

function Breakdown({ cap }) {
  const parts = [
    { key: "cash", label: t("ጥሬ ገንዘብ"), value: cap.cash },
    { key: "stock", label: t("የክምችት ዋጋ"), value: cap.stock },
    { key: "recv", label: t("ተቀባይ ዕዳ"), value: cap.receivables },
  ];
  return (
    <div className="breakdown">
      <Donut empty={t("ገና መረጃ የለም።")} colors={BLUES} center={compact(cap.balance)} sub={t("የካፒታል ሒሳብ")}
        data={parts.map((p) => ({ name: p.label, value: p.value }))} />
      <div className="bar-list" style={{ marginTop: 12 }}>
        {parts.map((p, i) => (
          <div className="top split" key={p.key}><span><i className="dot" style={{ background: BLUES[i] }} />{p.label}</span><b className={Number(p.value) < 0 ? "neg" : ""}>{fmt(p.value)}</b></div>
        ))}
        <div className="top split total"><span>{t("የካፒታል ሒሳብ")}</span><b>{fmt(cap.balance)}</b></div>
        <div className="top split muted"><span>{t("መነሻ ካፒታል")}</span><span>{fmt(cap.initial)}</span></div>
        <div className="top split muted"><span>{t("ዕድገት")}</span><span className={Number(cap.growth) < 0 ? "neg" : "pos"}>{signed(cap.growth)}</span></div>
      </div>
    </div>
  );
}

export default function Bank() {
  const me = useMe();
  const [token, setToken] = useState(null); // በማህደረ ትውስታ ብቻ — ገጹ ሲከፈት ሁልጊዜ ባዶ ነው
  useEffect(() => {
    if (!token) return undefined;
    const id = setTimeout(() => setToken(null), 14 * 60 * 1000);
    return () => clearTimeout(id);
  }, [token]);
  if (me && !me.is_superuser) return <NoAccess />;
  if (!token) return <UnlockGate title={t("ባንክ")} endpoint="/auth/bank-unlock/" onOpen={setToken} />;
  return <BankInner token={token} onLock={() => setToken(null)} />;
}

function BankInner({ token, onLock }) {
  const toast = useToast();
  const q = encodeURIComponent(token);
  const u = (p) => `${p}?bt=${q}`;
  const ua = (p, at) => `${p}?bt=${q}&at=${encodeURIComponent(at)}`;
  const list = useResource(u("/bank/"));
  const sum = useResource(u("/bank-summary/"));
  const [busy, run] = useSubmit();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [edit, setEdit] = useState(null);   // {id,..., at}
  const [del, setDel] = useState(null);     // {id, at}
  const [payId, setPayId] = useState(null);

  const [search, setSearch] = useState("");
 
  const [kindF, setKindF] = useState("all");
  const [stateF, setStateF] = useState("all");

  const reloadAll = () => { list.reload(); sum.reload(); };
  const openModal = (kind) => { setForm({ amount: "", reason: "" }); setModal(kind); };

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.post(u("/bank/"), { ...todayEth(), amount: num(form.amount), kind: modal, reason: form.reason.trim() }));
    if (ok) { setModal(null); reloadAll(); }
  };
  const askEdit = async (r) => {
    const at = await askPassword("edit");
    if (at) setEdit({ id: r.id, y: r.y, m: r.m, d: r.d, amount: r.amount, kind: r.kind, reason: r.reason || "", at });
  };
  const saveEdit = async () => {
    const ok = await run(() => api.put(ua(`/bank/${edit.id}/`, edit.at), { y: edit.y, m: edit.m, d: edit.d, amount: num(edit.amount), kind: edit.kind, reason: edit.reason.trim() }), undefined, "edit");
    if (ok) { setEdit(null); reloadAll(); }
  };
  const askDelete = async (r) => {
    const at = await askPassword("delete");
    if (at) setDel({ id: r.id, at });   // ከዚያ "ይሰረዝ?" የማረጋገጫ መስኮት ይታያል
  };
  const confirmRemove = async () => {
    const { id, at } = del;
    setDel(null);
    try {
      await api.del(ua(`/bank/${id}/`, at));
      toast(t("ተሰርዟል"), "del");
      if (edit?.id === id) setEdit(null);
      reloadAll();
    } catch (e) { toast(e.message, "err"); }
  };
  const confirmPay = async () => {
    const id = payId;
    setPayId(null);
    try {
      await api.post(u(`/bank/${id}/pay/`), {});
      toast(t("ዕዳው ተከፍሏል"));
      if (edit?.id === id) setEdit(null);
      reloadAll();
    } catch (e) { toast(e.message, "err"); }
  };

  const all = list.data || [];
  const rows = all.filter((r) => {
    if (kindF !== "all" && r.kind !== kindF) return false;
    if (stateF === "open" && r.repaid) return false;
    if (stateF === "repaid" && !r.repaid) return false;
    return hit(search, r.reason, r.amount);
  });
  const filtering = !!search || kindF !== "all" || stateF !== "all";
  const resetFilters = () => { setSearch(""); setKindF("all"); setStateF("all"); };

  const s = sum.data;
  const labels = s ? s.months.map((m) => MONTHS[m.m - 1].slice(0, 3)) : [];
  const names = s ? s.months.map((m) => MONTHS[m.m - 1]) : [];
  const payRow = all.find((r) => r.id === payId);
  const delRow = all.find((r) => r.id === del?.id);

  return (
    <>
      <PageHeader title={t("ባንክ")}>
        <Button variant="ghost" onClick={onLock}>{t("ቆልፍ")}</Button>
      </PageHeader>
      <ErrorNote error={sum.error} retry={sum.reload} />

      <div className="dash">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "stretch", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 240, flex: "0 1 280px" }}>
            {s ? <Kpi tone="t2" icon={<Icon name="payment" size={17} />} label={t("የካፒታል ሒሳብ")} value={s.capital.balance} unit={t("ብር")}
              change={s.capital.change} note={t("ከመነሻው {v}", { v: signed(s.capital.growth) })} /> : <Loading />}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <Button icon="plus" onClick={() => openModal("own")}>{t("ገንዘብ ጨምር")}</Button>
            <Button variant="ghost" icon="plus" onClick={() => openModal("debt")}>{t("በዕዳ ገንዘብ ጨምር")}</Button>
          </div>
        </div>

        {s && (
          <>
            <div className="dk-row two">
              <Kpi tone="t1" icon={<Icon name="sales" size={17} />} label={t("የዛሬ ሽያጭ")} value={s.profit.day_sales} unit={t("ብር")}
                change={s.profit.day_change} note={t("ከትናንት ጋር")} />
              <Kpi tone="t3" icon={<Icon name="dashboard" size={17} />} label={t("የ{month} ሽያጭ", { month: MONTHS[s.period.m - 1] })} value={s.profit.month_sales} unit={t("ብር")}
                change={s.profit.month_change} note={t("ከባለፈው ወር ጋር")} />
            </div>
            <div className="dk-row">
              <Kpi tone="t1" icon={<Icon name="sales" size={17} />} label={t("የወሩ የተጣራ ትርፍ")} value={s.profit.month_net} unit={t("ብር")}
                change={s.profit.month_net_change} note={t("ወጪ {v}", { v: fmt(s.profit.month_expenses) })} />
              <Kpi tone="t3" icon={<Icon name="dashboard" size={17} />} label={t("የዓመቱ የተጣራ ትርፍ")} value={s.profit.year_net} unit={t("ብር")}
                change={s.profit.year_net_change} note={t("ሽያጭ {v}", { v: fmt(s.profit.year_sales) })} />
              <Kpi tone="t2" icon={<Icon name="payment" size={17} />} label={t("የገንዘብ ሒሳብ")} value={s.cashflow.balance} unit={t("ብር")}
                change={s.cashflow.balance_change} note={t("በእጅ/በባንክ ያለ")}
                extra={Number(s.cashflow.bank_debt) > 0 ? <DebtIn value={s.cashflow.bank_debt} /> : null} />
              <Kpi tone="t4" icon={<Icon name="plus" size={17} />} label={t("የወሩ ገንዘብ ገቢ")} value={s.cashflow.month_in} unit={t("ብር")} />
              <Kpi tone="t5" icon={<Icon name="expenses" size={17} />} label={t("የወሩ ገንዘብ ወጪ")} value={s.cashflow.month_out} unit={t("ብር")}
                note={t("የተጣራ ፍሰት {v}", { v: signed(s.cashflow.month_net) })} />
            </div>

            <div className="dgrid b2">
              <Panel title={t("የካፒታል ስብጥር")}><Breakdown cap={s.capital} /></Panel>
              <Panel title={t("የገንዘብ ሒሳብ በወር መጨረሻ")} aside={<small>{t("የዓመቱ የተጣራ ፍሰት {v}", { v: signed(s.cashflow.year_net) })}</small>}>
                <LineChart labels={labels} names={names} series={[
                  { name: t("የገንዘብ ሒሳብ"), color: BLUES[0], values: s.cashflow.months.map((m) => Number(m.balance)) },
                ]} />
              </Panel>
            </div>

            <div className="dgrid b3">
              <Panel title={t("ወርሃዊ የገንዘብ ፍሰት · {y}", { y: s.period.y })} aside={<Legend series={[{ name: t("የገባ"), color: BLUES[0] }, { name: t("የወጣ"), color: BLUES[3] }]} />}>
                <BarChart labels={labels} names={names} series={[
                  { name: t("የገባ"), color: BLUES[0], values: s.cashflow.months.map((m) => Number(m.inflow)) },
                  { name: t("የወጣ"), color: BLUES[3], values: s.cashflow.months.map((m) => Number(m.outflow)) },
                ]} />
              </Panel>
              <Panel title={t("የተጣራ ትርፍ በወር")} aside={<Legend series={[{ name: t("ትርፍ"), color: BLUES[0] }, { name: t("ወጪ"), color: BLUES[3] }]} />}>
                <LineChart labels={labels} names={names} series={[
                  { name: t("ትርፍ"), color: BLUES[0], values: s.months.map((m) => Number(m.net)) },
                  { name: t("ወጪ"), color: BLUES[3], values: s.months.map((m) => Number(m.expenses)) },
                ]} />
              </Panel>
            </div>
          </>
        )}

        <ErrorNote error={list.error} retry={list.reload} />

        <Toolbar active={filtering} onReset={resetFilters}>
          <SearchBar value={search} onChange={setSearch} placeholder={bi("ምክንያት ወይም ገንዘብ ፈልግ…", "Search reason or amount…")} />
          <FilterSelect label={t("አይነት")} value={kindF} onChange={setKindF} options={[
            ALL(), { value: "own", label: t("ያለ ዕዳ") }, { value: "debt", label: t("በዕዳ") },
          ]} />
          <FilterSelect label={t("ሁኔታ")} value={stateF} onChange={setStateF} options={[
            ALL(), { value: "open", label: bi("ያልተመለሰ", "Not repaid") }, { value: "repaid", label: bi("የተመለሰ", "Repaid") },
          ]} />
        </Toolbar>

        <Card flush>
          {list.loading && !list.data ? <Loading /> : rows.length === 0 ? <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("ገና ገንዘብ አልተጨመረም።")}</Empty> : (
            <div className="table-wrap">
              <table className="t">
                <thead>
                  <tr><th>{t("ቀን")}</th><th className="num">{t("ገንዘብ")}</th><th>{t("አይነት")}</th><th>{t("ምክንያት")}</th><th>{t("ድርጊት")}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isEdit = edit?.id === r.id;
                    const isDebt = r.kind === "debt";
                    return (
                      <tr key={r.id}>
                        <td className="muted">{dstr(r)}</td>
                        <td className="num strong">
                          {isEdit
                            ? <input type="number" step="any" min="0" style={{ width: 110 }} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} />
                            : fmt(r.amount)}
                        </td>
                        <td>
                          {isEdit ? (
                            <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                              <option value="own">{t("ያለ ዕዳ")}</option>
                              <option value="debt">{t("በዕዳ")}</option>
                            </select>
                          ) : isDebt ? <Pill tone="warn">{t("በዕዳ")}</Pill> : <Pill tone="ok">{t("ያለ ዕዳ")}</Pill>}
                        </td>
                        <td>
                          {isEdit
                            ? <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
                            : (r.reason || <span className="muted">—</span>)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {r.repaid ? (
                              <span className="muted" style={{ color: BLUE, fontWeight: 600, fontSize: 13 }}>
                                {t("ዕዳው ተከፍሏል")} · {dstr({ y: r.rep_y, m: r.rep_m, d: r.rep_d })}
                              </span>
                            ) : (
                              <>
                                {isEdit
                                  ? <button style={btn(GREEN)} disabled={busy} onClick={saveEdit}>{t("አስቀምጥ")}</button>
                                  : <button style={btn(ORANGE)} onClick={() => askEdit(r)}>{t("አስተካክል")}</button>}
                                {isDebt
                                  ? <button style={btn(BLUE)} onClick={() => setPayId(r.id)}>{t("ክፈል")}</button>
                                  : <button style={btn(RED)} onClick={() => askDelete(r)}>{t("ሰርዝ")}</button>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {modal && (
        <Popup onClose={() => setModal(null)} onSubmit={add}>
          <h3 style={{ margin: 0 }}>{modal === "debt" ? t("በዕዳ ገንዘብ ጨምር") : t("ገንዘብ ጨምር")}</h3>
          <Field label={t("ገንዘብ")}>
            <input type="number" step="any" min="0" autoFocus required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t("ምክንያት")}>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="form-actions">
            <Button variant="ghost" type="button" onClick={() => setModal(null)}>{t("ተው")}</Button>
            <Button type="submit" disabled={busy}>{t("አስቀምጥ")}</Button>
          </div>
        </Popup>
      )}

      {del && (
        <Popup onClose={() => setDel(null)}>
          <h3 style={{ margin: 0 }}>{bi("እርግጠኛ ነዎት?", "Are you sure?")}</h3>
          <p className="muted" style={{ margin: 0 }}>{fmt(delRow?.amount ?? 0)} {t("ብር")} · {t("ይህ መዝገብ ከባንክ ይሰረዛል፤ ካፒታሉም ይቀየራል።")}</p>
          <div className="form-actions">
            <Button variant="ghost" type="button" onClick={() => setDel(null)}>{t("ተው")}</Button>
            <Button variant="danger" type="button" onClick={confirmRemove}>{bi("አዎ፣ ሰርዝ", "Yes, delete")}</Button>
          </div>
        </Popup>
      )}

      {payId !== null && (
        <Popup onClose={() => setPayId(null)}>
          <h3 style={{ margin: 0 }}>{t("ዕዳ ይከፈል?")}</h3>
          <p className="muted" style={{ margin: 0 }}>{fmt(payRow?.amount ?? 0)} {t("ብር")} · {t("ይህ ገንዘብ ለአበዳሪው ተመልሶ ከገንዘብ ሒሳብ ይቀነሳል፤ ትርፍን አይነካም።")}</p>
          <div className="form-actions">
            <Button variant="ghost" type="button" onClick={() => setPayId(null)}>{t("ተው")}</Button>
            <button type="button" style={{ ...btn(BLUE), padding: "10px 18px", fontSize: 14 }} onClick={confirmPay}>{t("ክፈል")}</button>
          </div>
        </Popup>
      )}
    </>
  );
}