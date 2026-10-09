import { useEffect, useState } from "react";
import { t } from "../lib/i18n.js";
import { api } from "../lib/api.js";
import { MONTHS, dstr, todayEth } from "../lib/ethiopian.js";
import { num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import { BarChart, Legend, LineChart } from "../components/Charts.jsx";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHeader, Pill } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { Donut, Kpi, Panel, compact } from "../components/Viz.jsx";

const GREEN = "#16a34a", ORANGE = "#f97316", RED = "#dc2626", BLUE = "#2563eb";
const btn = (bg) => ({ background: bg, color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 });
const overlay = { position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 };
const signed = (v) => `${Number(v) > 0 ? "+" : ""}${fmt(v)}`;
const BLUES = ["#38bdf8", "#2563eb", "#22d3ee", "#818cf8"];

function Popup({ onClose, onSubmit, children }) {
  const Tag = onSubmit ? "form" : "div";
  return (
    <div style={overlay} onClick={onClose}>
      <Tag className="card form" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit} style={{ width: "100%", maxWidth: 400 }}>
        {children}
      </Tag>
    </div>
  );
}

const DebtIn = ({ value }) => (
  <span className="debt-in" title={t("በዕዳ የገባ ገንዘብ")}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
    {fmt(value)}
  </span>
);

/* ---------- የይለፍ ቃል በር ---------- */
function Gate({ onOpen }) {
  const [pw, setPw] = useState("");
  const [busy, run] = useSubmit();
  const submit = async (e) => {
    e.preventDefault();
    let tok = null;
    const ok = await run(async () => { const r = await api.post("/auth/bank-unlock/", { password: pw }); tok = r?.token; }, "");
    if (ok && tok) onOpen(tok); else setPw("");
  };
  return (
    <>
      <PageHeader title={t("ባንክ")} />
      <Popup onSubmit={submit}>
        <div style={{ textAlign: "center" }}>
          <div className="lock-ic">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          </div>
          <h3 style={{ margin: "10px 0 4px" }}>{t("ባንክ")}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("የባንክ ገጽ የተጠበቀ ነው። ለመክፈት የይለፍ ቃልዎን ያስገቡ።")}</p>
        </div>
        <Field label={t("የይለፍ ቃል")}>
          <input type="password" autoFocus required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={() => { window.location.hash = "/"; }}>{t("ተመለስ")}</Button>
          <Button type="submit" disabled={busy}>{busy ? t("በመክፈት ላይ…") : t("ክፈት")}</Button>
        </div>
      </Popup>
    </>
  );
}

/* ---------- የካፒታል ስብጥር ---------- */
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

/* ---------- ዋናው ገጽ ---------- */
export default function Bank() {
  const [token, setToken] = useState(null); // በማህደረ ትውስታ ብቻ — ገጹ ሲከፈት ሁልጊዜ ባዶ ነው
  useEffect(() => {
    if (!token) return undefined;
    const id = setTimeout(() => setToken(null), 14 * 60 * 1000); // ቁልፉ ከማለቁ በፊት ይቆልፋል
    return () => clearTimeout(id);
  }, [token]);
  if (!token) return <Gate onOpen={setToken} />;
  return <BankInner token={token} onLock={() => setToken(null)} />;
}

function BankInner({ token, onLock }) {
  const toast = useToast();
  const q = encodeURIComponent(token);
  const u = (p) => `${p}?bt=${q}`;
  const list = useResource(u("/bank/"));
  const sum = useResource(u("/bank-summary/"));
  const [busy, run] = useSubmit();
  const [modal, setModal] = useState(null); // null | "own" | "debt"
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [edit, setEdit] = useState(null);   // አንድ ረድፍ ብቻ
  const [delId, setDelId] = useState(null);
  const [payId, setPayId] = useState(null);

  const reloadAll = () => { list.reload(); sum.reload(); };
  const openModal = (kind) => { setForm({ amount: "", reason: "" }); setModal(kind); };

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.post(u("/bank/"), { ...todayEth(), amount: num(form.amount), kind: modal, reason: form.reason.trim() }));
    if (ok) { setModal(null); reloadAll(); }
  };
  const startEdit = (r) => setEdit({ id: r.id, y: r.y, m: r.m, d: r.d, amount: r.amount, kind: r.kind, reason: r.reason || "" });
  const saveEdit = async () => {
    const ok = await run(() => api.put(u(`/bank/${edit.id}/`), { y: edit.y, m: edit.m, d: edit.d, amount: num(edit.amount), kind: edit.kind, reason: edit.reason.trim() }), undefined, "edit");
    if (ok) { setEdit(null); reloadAll(); }
  };
  const confirmRemove = async () => {
    const id = delId;
    setDelId(null);
    try {
      await api.del(u(`/bank/${id}/`));
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

  const rows = list.data || [];
  const s = sum.data;
  const labels = s ? s.months.map((m) => MONTHS[m.m - 1].slice(0, 3)) : [];
  const names = s ? s.months.map((m) => MONTHS[m.m - 1]) : [];
  const payRow = rows.find((r) => r.id === payId);
  const delRow = rows.find((r) => r.id === delId);

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
        <Card flush>
          {list.loading && !list.data ? <Loading /> : rows.length === 0 ? <Empty>{t("ገና ገንዘብ አልተጨመረም።")}</Empty> : (
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
                                  : <button style={btn(ORANGE)} onClick={() => startEdit(r)}>{t("አስተካክል")}</button>}
                                {isDebt
                                  ? <button style={btn(BLUE)} onClick={() => setPayId(r.id)}>{t("ክፈል")}</button>
                                  : <button style={btn(RED)} onClick={() => setDelId(r.id)}>{t("ሰርዝ")}</button>}
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

      {delId !== null && (
        <Popup onClose={() => setDelId(null)}>
          <h3 style={{ margin: 0 }}>{t("ይሰረዝ?")}</h3>
          <p className="muted" style={{ margin: 0 }}>{fmt(delRow?.amount ?? 0)} {t("ብር")} · {t("ይህ መዝገብ ከባንክ ይሰረዛል፤ ካፒታሉም ይቀየራል።")}</p>
          <div className="form-actions">
            <Button variant="ghost" type="button" onClick={() => setDelId(null)}>{t("ተው")}</Button>
            <Button variant="danger" type="button" onClick={confirmRemove}>{t("ሰርዝ")}</Button>
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