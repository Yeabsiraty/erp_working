import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { num, useSubmit } from "../lib/forms.js";
import { fmt } from "../lib/format.js";
import { useResource, useToast } from "../lib/hooks.jsx";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHeader, Pill } from "../components/ui.jsx";

const btn = (bg) => ({ background: bg, color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 });
const GREEN = "#16a34a", ORANGE = "#f97316", RED = "#dc2626";

export default function Bank() {
  const toast = useToast();
  const list = useResource("/bank/");
  const dash = useResource("/dashboard/");
  const [busy, run] = useSubmit();
  const [modal, setModal] = useState(null); // null | "own" | "debt"
  const [form, setForm] = useState({ amount: "", reason: "" });
  const [edit, setEdit] = useState(null);   // the ONE row being edited
  const [delId, setDelId] = useState(null); // the ONE row waiting for delete confirmation

  const reloadAll = () => { list.reload(); dash.reload(); };
  const openModal = (kind) => { setForm({ amount: "", reason: "" }); setModal(kind); };

  const add = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.post("/bank/", { ...todayEth(), amount: num(form.amount), kind: modal, reason: form.reason.trim() }));
    if (ok) { setModal(null); reloadAll(); }
  };
  const startEdit = (r) => setEdit({ id: r.id, y: r.y, m: r.m, d: r.d, amount: r.amount, kind: r.kind, reason: r.reason || "" });
  const saveEdit = async () => {
    const ok = await run(() => api.put(`/bank/${edit.id}/`, { y: edit.y, m: edit.m, d: edit.d, amount: num(edit.amount), kind: edit.kind, reason: edit.reason.trim() }), undefined, "edit");
    if (ok) { setEdit(null); reloadAll(); }
  };
  const confirmRemove = async () => {
    const id = delId;
    setDelId(null);
    try {
      await api.del(`/bank/${id}/`);
      toast(t("ተሰርዟል"));
      if (edit?.id === id) setEdit(null);
      reloadAll();
    } catch (e) { toast(e.message, "err"); }
  };

  const rows = list.data || [];
  const capital = dash.data?.capital?.balance ?? 0;

  return (
    <>
      <PageHeader title={t("ባንክ")} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div className="card kpi" style={{ minWidth: 220 }}>
          <span className="k-label">{t("የካፒታል ሒሳብ")}</span>
          <span className="k-value">{fmt(capital)}<small>{t("ብር")}</small></span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button icon="plus" onClick={() => openModal("own")}>{t("ገንዘብ ጨምር")}</Button>
          <Button variant="ghost" icon="plus" onClick={() => openModal("debt")}>{t("በዕዳ ገንዘብ ጨምር")}</Button>
        </div>
      </div>

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
                        ) : r.kind === "debt" ? <Pill tone="warn">{t("በዕዳ")}</Pill> : <Pill tone="ok">{t("ያለ ዕዳ")}</Pill>}
                      </td>
                      <td>
                        {isEdit
                          ? <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} />
                          : (r.reason || <span className="muted">—</span>)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {isEdit
                            ? <button style={btn(GREEN)} disabled={busy} onClick={saveEdit}>{t("አስቀምጥ")}</button>
                            : <button style={btn(ORANGE)} onClick={() => startEdit(r)}>{t("አስተካክል")}</button>}
                          <button style={btn(RED)} onClick={() => setDelId(r.id)}>{t("ሰርዝ")}</button>
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

      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <form
            className="card form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={add}
            style={{ width: "100%", maxWidth: 420 }}
          >
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
          </form>
        </div>
      )}

      {delId !== null && (
        <div
          onClick={() => setDelId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <h3 style={{ margin: 0 }}>{t("ይሰረዝ?")}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {fmt(rows.find((r) => r.id === delId)?.amount ?? 0)} {t("ብር")} · {t("ይህ መዝገብ ከባንክ ይሰረዛል፤ ካፒታሉም ይቀየራል።")}
            </p>
            <div className="form-actions">
              <Button variant="ghost" type="button" onClick={() => setDelId(null)}>{t("ተው")}</Button>
              <Button variant="danger" type="button" onClick={confirmRemove}>{t("ሰርዝ")}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}