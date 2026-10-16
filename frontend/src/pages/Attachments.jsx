import { useEffect, useState } from "react";
import { bi } from "../lib/bi.js";
import { api } from "../lib/api.js";
import { num, useSubmit } from "../lib/forms.js";
import { fmt, fmt0, proformaTotals, r2 } from "../lib/format.js";
import { fmtIssued, fromInput, nowStamp, toInput } from "../lib/attachment.js";
import { go, useResource, useSettings, useToast } from "../lib/hooks.jsx";
import Icon from "../components/Icon.jsx";
import { AttachmentSheet } from "../components/AttachmentSheet.jsx";
import { ScaledSheet } from "../components/ProformaSheet.jsx";
import { GuardedDelete, GuardedEdit, askPassword, setGrant, takeGrant, withAt } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";
import { Button, Card, Empty, ErrorNote, Field, Loading, PageHeader } from "../components/ui.jsx";

const PageStyle = () => <style>{"@media print { @page { size: A4 portrait; margin: 0; } }"}</style>;
const blankLine = () => ({ name: "", unit: "", qty: "", price: "" });
const filled = (l) => l.name.trim() || l.unit.trim() || num(l.qty) > 0 || num(l.price) > 0;

/* ------------------------------------------------------------------ ዝርዝር (ከፕሮፎርማ ሠንጠረዥ በታች) */
export function AttachmentTable({ onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload } = useResource("/attachments/");
  const [search, setSearch] = useState("");
  const [yearF, setYearF] = useState("all");

  const yearOf = (a) => (a.issued || "").slice(0, 4);
  const all = data || [];
  const years = [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse();
  const rows = all.filter((a) => {
    if (yearF !== "all" && yearOf(a) !== yearF) return false;
    return hit(search, a.bill_to, a.id, a.proforma_number);   // customer name or id (no)
  });
  const filtering = !!search || yearF !== "all";
  const reset = () => { setSearch(""); setYearF("all"); };

  const remove = async (id, token) => {
    try {
      await api.del(withAt(`/attachments/${id}/`, token));
      toast(bi("ተሰርዟል", "Deleted"), "del");
      reload();
      onChanged?.();   // the proforma table must show "Attach." again
    } catch (e) { toast(e.message, "err"); }
  };

  return (
    <>
      <h2 className="sec-title">Attachment</h2>
      <ErrorNote error={error} retry={reload} />
      <Toolbar active={filtering} onReset={reset}>
        <SearchBar value={search} onChange={setSearch} placeholder={bi("ደንበኛ ወይም ቁጥር ፈልግ…", "Search customer or No.…")} />
        <FilterSelect label={bi("ዓ.ም", "Year")} value={yearF} onChange={setYearF} options={[
          ALL(), ...years.map((y) => ({ value: y, label: y })),
        ]} />
      </Toolbar>
      <Card flush>
        {loading && !data ? <Loading /> : rows.length === 0 ? (
          <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : bi("ገና አባሪ አልተፈጠረም።", "No attachments yet.")}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>ID</th><th>{bi("ቀን", "Date")}</th><th>Bill to</th><th>{bi("ፕሮፎርማ", "Proforma")}</th>
                  <th className="num">{bi("ጠቅላላ", "Total")}</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="strong"><a href={`#/attachment/${a.id}`}>{a.id}</a></td>
                    <td className="muted">{fmtIssued(a.issued)}</td>
                    <td>{a.bill_to || "—"}</td>
                    <td className="muted">{a.proforma_number || "—"}</td>
                    <td className="num strong">{fmt(a.totals.grand)} <span className="muted">ETB</span></td>
                    <td className="act">
                      <a className="icon-btn" href={`#/attachment/${a.id}`} aria-label={bi("ክፈት", "Open")}><Icon name="open" size={17} /></a>
                      <GuardedEdit onGranted={(tok) => { setGrant(`attachment:${a.id}`, tok); go(`/attachment/${a.id}/edit`); }} />
                      <GuardedDelete onConfirm={(tok) => remove(a.id, tok)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ ማሳያ / ማተሚያ */
export function AttachmentView({ id }) {
  const { data, loading, error, reload } = useResource(`/attachments/${id}/`);
  useEffect(() => {
    const old = document.title;
    if (data) document.title = `Attachment ${data.id}`;
    return () => { document.title = old; };
  }, [data]);
  const edit = async () => {
    const tok = await askPassword("edit");
    if (!tok) return;
    setGrant(`attachment:${id}`, tok);
    go(`/attachment/${id}/edit`);
  };
  return (
    <>
      <PageStyle />
      <div className="pf-viewbar no-print">
        <Button variant="ghost" icon="back" onClick={() => go("/proforma")}>{bi("ዝርዝር", "List")}</Button>
        <Button variant="ghost" icon="edit" onClick={edit}>{bi("አስተካክል", "Edit")}</Button>
        <Button icon="printer" onClick={() => window.print()}>{bi("አትም / PDF", "Print / PDF")}</Button>
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (
        <div className="att-stage"><ScaledSheet><AttachmentSheet a={data} /></ScaledSheet></div>
      )}
      <p className="muted no-print" style={{ marginTop: 12, fontSize: 13 }}>
        {bi("በህትመት መስኮቱ “Save as PDF” ይምረጡ።", "In the print dialog choose “Save as PDF”.")}
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ አዲስ / ከፕሮፎርማ / ማስተካከያ */
export function AttachmentEditor({ id, fromProforma }) {
  const { settings } = useSettings();
  const toast = useToast();
  const existing = useResource(id ? `/attachments/${id}/` : null);
  const source = useResource(fromProforma ? `/proformas/${fromProforma}/` : null);
  const nx = useResource("/attachments/next-ids/");
  const [f, setF] = useState(null);
  const [busy, run] = useSubmit();

  const fromSettings = (s) => ({
    issued: nowStamp(),
    bill_to: s.att_bill_to || "", tin: s.att_tin || "", address: s.att_address || "",
    ref: s.att_ref || "", fs_no: s.att_fs_no || "", vat_rate: s.vat_rate, proforma: null,
  });

  // 1) አዲስ ባዶ አባሪ
  useEffect(() => {
    if (id || fromProforma || !settings) return;
    setF((cur) => cur || { ...fromSettings(settings), items: [blankLine(), blankLine()] });
  }, [id, fromProforma, settings]);

  // 2) ከፕሮፎርማ መፍጠር ("Attach." ቁልፍ)
  useEffect(() => {
    const p = source.data;
    if (!fromProforma || !p || !settings) return;
    if (p.attachment_id) { go(`/attachment/${p.attachment_id}`); return; }  // already generated
    setF((cur) => cur || {
      ...fromSettings(settings),
      // to use the proforma client as Bill to:  bill_to: p.client || settings.att_bill_to || ""
      proforma: p.id,
      items: p.items.map((i) => ({ name: i.name || "", unit: "", qty: i.qty, price: i.price })),
    });
  }, [fromProforma, source.data, settings]);

  // 3) ማስተካከያ
  useEffect(() => {
    const a = existing.data;
    if (!id || !a) return;
    setF({
      issued: a.issued, bill_to: a.bill_to, tin: a.tin, address: a.address, ref: a.ref, fs_no: a.fs_no,
      vat_rate: a.vat_rate, proforma: a.proforma,
      items: a.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty, price: i.price })),
    });
  }, [id, existing.data]);

  if (id && existing.error) return <ErrorNote error={existing.error} retry={existing.reload} />;
  if (fromProforma && source.error) return <ErrorNote error={source.error} retry={source.reload} />;
  if (!f) return <Loading />;

  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setLine = (i, p) => set({ items: f.items.map((it, k) => (k === i ? { ...it, ...p } : it)) });
  const addLine = () => set({ items: [...f.items, blankLine()] });
  const delLine = (i) => set({ items: f.items.filter((_, k) => k !== i) });

  // ያልተቀመጡ መስመሮች የሚቀጥለውን የዳታቤዝ id ቅድመ-እይታ ያሳያሉ (ሲቀመጥ ዳታቤዙ ራሱ ይሰጣል)
  let k = 0;
  const nextItem = Number(nx.data?.next_item_id) || 1;
  const lines = f.items.map((it) => ({ ...it, shownId: it.id ?? nextItem + k++ }));
  const live = {
    ...f,
    items: lines.map((l) => ({ id: l.shownId, name: l.name, unit: l.unit, qty: num(l.qty), price: num(l.price) })),
  };
  const totals = proformaTotals(live.items, f.vat_rate);

  const save = async (e) => {
    e.preventDefault();
    const clean = f.items.filter(filled);
    if (!clean.length) { toast(bi("ቢያንስ አንድ መስመር ያስገቡ።", "Add at least one line."), "err"); return; }
    let tok = null;
    if (id) {   // ማስተካከል የይለፍ ቃል ይጠይቃል
      tok = takeGrant(`attachment:${id}`) || (await askPassword("edit"));
      if (!tok) return;
    }
    const body = {
      issued: f.issued, bill_to: f.bill_to.trim(), tin: f.tin.trim(), address: f.address.trim(), proforma: f.proforma || null,
      items: clean.map((it) => ({
        ...(it.id ? { id: it.id } : {}),
        name: it.name.trim(), unit: it.unit.trim(), qty: num(it.qty), price: num(it.price),
      })),
    };
    let saved;
    const ok = await run(async () => {
      saved = id ? await api.put(withAt(`/attachments/${id}/`, tok), body) : await api.post("/attachments/", body);
    });
    if (ok) go(`/attachment/${saved.id}`);
  };

  return (
    <>
      <PageStyle />
      <PageHeader title={id ? bi(`አስተካክል · አባሪ ${id}`, `Edit · Attachment ${id}`) : bi("አዲስ አባሪ", "New attachment")}>
        <Button variant="ghost" icon="back" onClick={() => go("/proforma")}>{bi("ተመለስ", "Back")}</Button>
      </PageHeader>

      <div className="att-editor">
        <form className="card form" onSubmit={save}>
          <Field label="Date">
            <input type="datetime-local" step="1" required value={toInput(f.issued)}
              onChange={(e) => set({ issued: fromInput(e.target.value) })} />
          </Field>
          <Field label="Bill to"><input value={f.bill_to} maxLength={160} onChange={(e) => set({ bill_to: e.target.value })} /></Field>
          <div className="row2">
            <Field label="TIN"><input value={f.tin} maxLength={60} onChange={(e) => set({ tin: e.target.value })} /></Field>
            <Field label="Address"><input value={f.address} maxLength={200} onChange={(e) => set({ address: e.target.value })} /></Field>
          </div>
          <div className="row2">
            <Field label="Ref."><input className="att-ro" value={f.ref} readOnly disabled /></Field>
            <Field label="FS. NO"><input className="att-ro" value={f.fs_no} readOnly disabled /></Field>
          </div>

          <div className="att-lines">
            <span className="lbl muted" style={{ fontSize: 13, fontWeight: 500 }}>{bi("ዕቃዎች", "Items")}</span>
            {lines.map((l, i) => (
              <div className="att-line" key={i}>
                <div className="att-line-top">
                  <span className="att-idb" title="ID">{l.shownId}</span>
                  <input placeholder="Description" maxLength={300} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                  <button type="button" className="icon-btn" aria-label={bi("አስወግድ", "Remove")} disabled={f.items.length === 1} onClick={() => delLine(i)}>
                    <Icon name="x" size={17} />
                  </button>
                </div>
                <div className="att-line-grid">
                  <label><span>Un.</span><input maxLength={30} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} /></label>
                  <label><span>Qty</span><input type="number" step="any" min="0" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></label>
                  <label><span>Price</span><input type="number" step="any" min="0" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} /></label>
                  <label><span>Total</span><output>{fmt(r2(num(l.price) * num(l.qty)))}</output></label>
                </div>
              </div>
            ))}
            <div><Button type="button" size="sm" variant="ghost" icon="plus" onClick={addLine}>{bi("መስመር ጨምር", "Add line")}</Button></div>
          </div>

          <div className="preview"><span>Subtotal</span><b>{fmt(totals.sub)}</b></div>
          <div className="preview"><span>VAT ({fmt0(f.vat_rate)}%)</span><b>{fmt(totals.tot)}</b></div>
          <div className="preview"><span>Grand Total</span><b>{fmt(totals.grand)} ETB</b></div>
          <div className="form-actions">
            <Button type="submit" disabled={busy}>{busy ? bi("በማስቀመጥ ላይ…", "Saving…") : bi("አስቀምጥና ክፈት", "Save and open")}</Button>
          </div>
        </form>

        <div className="att-stage"><ScaledSheet><AttachmentSheet a={live} /></ScaledSheet></div>
      </div>
    </>
  );
}