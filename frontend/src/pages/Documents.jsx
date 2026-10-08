import { useEffect, useState } from "react";
import { t } from "../lib/i18n.js";
import { api } from "../lib/api.js";
import { dstr, todayEth } from "../lib/ethiopian.js";
import { num, useSubmit } from "../lib/forms.js";
import { fmt, pid, proformaTotals } from "../lib/format.js";
import { go, useResource, useSettings, useToast } from "../lib/hooks.jsx";
import Icon from "../components/Icon.jsx";
import { ProformaSheet, ScaledSheet } from "../components/ProformaSheet.jsx";
import { Button, Card, ConfirmDelete, DateField, Empty, ErrorNote, Field, Loading, PageHeader } from "../components/ui.jsx";

/** ፕሮፎርማና የክፍያ ጥያቄ አንድ ኮድ ይጋራሉ። */
export const DOCS = {
  proforma: {
    api: "/proformas/", base: "/proforma", rate: "tot_rate", rateLabel: "VAT %", prefix: "PF",
    title: "ፕሮፎርማ", newTitle: "አዲስ ፕሮፎርማ", totalLabel: "Grand Total", settingsRate: "tot_rate", settingsTerms: "terms", due: false, money: true,
  },
  payment: {
    api: "/payment-requests/", base: "/payment", rate: "vat_rate", rateLabel: "VAT %", prefix: "PR",
    title: "የክፍያ ጥያቄ", newTitle: "አዲስ የክፍያ ጥያቄ", totalLabel: "AMOUNT DUE", settingsRate: "vat_rate", settingsTerms: "pr_terms", due: true, money: true,
  },
  delivery: {
    api: "/delivery-notes/", base: "/delivery", prefix: "DN", title: "የማድረሻ ሰነድ", newTitle: "አዲስ የማድረሻ ሰነድ",
    due: false, money: false, maxItems: 10, clientLabel: "ደንበኛ (Customer)",
  },
};

const blankLine = (c) => (c.money ? { name: "", price: "", qty: 1 } : { name: "" });

export function DocList({ kind }) {
  const c = DOCS[kind];
  const toast = useToast();
  const { data, loading, error, reload } = useResource(c.api);
  const remove = async (id) => {
    try { await api.del(`${c.api}${id}/`); toast(t("ተሰርዟል")); reload(); } catch (e) { toast(e.message, "err"); }
  };
  const rows = data || [];
  return (
    <>
      <PageHeader title={t(c.title)} subtitle={t("{n} ሰነዶች", { n: rows.length })}>
        <Button icon="plus" onClick={() => go(`${c.base}/new`)}>{t(c.newTitle)}</Button>
      </PageHeader>
      <ErrorNote error={error} retry={reload} />
      <Card flush>
        {loading && !data ? <Loading /> : rows.length === 0 ? <Empty>{t("ገና ሰነድ አልተፈጠረም።")}</Empty> : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t("ቁጥር")}</th><th>{t("ቀን")}</th><th>{t("ደንበኛ")}</th>
                  {c.due && <th>{t("መክፈያ ቀን")}</th>}
                  {c.money ? <th className="num">{t("ጠቅላላ")}</th> : <th className="num">{t("ዕቃዎች")}</th>}<th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="strong"><a href={`#${c.base}/${p.id}`}>{p.number}</a></td>
                    <td className="muted">{dstr(p)}</td>
                    <td>{p.client}</td>
                    {c.due && <td className="muted">{dstr({ y: p.due_y, m: p.due_m, d: p.due_d })}</td>}
                    {c.money
                      ? <td className="num strong">{fmt(p.totals.grand)} <span className="muted">ETB</span></td>
                      : <td className="num">{p.items.length}</td>}
                    <td className="act">
                      <a className="icon-btn" href={`#${c.base}/${p.id}`} aria-label={t("ክፈት")}><Icon name="open" size={17} /></a>
                      <a className="icon-btn" href={`#${c.base}/${p.id}/edit`} aria-label={t("አስተካክል")}><Icon name="edit" size={17} /></a>
                      <ConfirmDelete onConfirm={() => remove(p.id)} />
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

export function DocView({ kind, id }) {
  const c = DOCS[kind];
  const { settings } = useSettings();
  const { data, loading, error, reload } = useResource(`${c.api}${id}/`);
  useEffect(() => {
    const old = document.title;
    if (data) document.title = `${data.number} — ${{ payment: "Payment Request", delivery: "Delivery Note" }[kind] || "Proforma"}`;
    return () => { document.title = old; };
  }, [data, kind]);
  return (
    <>
      <div className="pf-viewbar no-print">
        <Button variant="ghost" icon="back" onClick={() => go(c.base)}>{t("ዝርዝር")}</Button>
        <Button variant="ghost" icon="edit" onClick={() => go(`${c.base}/${id}/edit`)}>{t("አስተካክል")}</Button>
        <Button icon="printer" onClick={() => window.print()}>{t("አትም / PDF")}</Button>
      </div>
      <ErrorNote error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (
        <div className="pf-stage">
          <ScaledSheet><ProformaSheet kind={kind} p={data} shop={settings} /></ScaledSheet>
        </div>
      )}
      <p className="muted no-print" style={{ marginTop: 12, fontSize: 13 }}>{t("በህትመት መስኮቱ “Save as PDF” ይምረጡ።")}</p>
    </>
  );
}

export function DocEditor({ kind, id }) {
  const c = DOCS[kind];
  const { settings } = useSettings();
  const toast = useToast();
  const existing = useResource(id ? `${c.api}${id}/` : null);
  const [f, setF] = useState(null);
  const [busy, run] = useSubmit();

  useEffect(() => {
    if (!id && settings) {
      const today = todayEth();
      setF({
        ...today, client: "", due_y: today.y, due_m: today.m, due_d: today.d, items: [blankLine(c)],
        ...(c.money ? { [c.rate]: settings[c.settingsRate], terms: settings[c.settingsTerms] } : {}),
      });
    }
  }, [id, settings, c.rate, c.settingsRate, c.settingsTerms]);
  useEffect(() => {
    const p = existing.data;
    if (id && p) {
      setF({
        y: p.y, m: p.m, d: p.d, seq: p.seq, client: p.client,
        ...(c.money ? { [c.rate]: p[c.rate], terms: p.terms } : {}),
        due_y: p.due_y, due_m: p.due_m, due_d: p.due_d,
        items: p.items.map((i) => (c.money ? { name: i.name, price: i.price, qty: i.qty } : { name: i.name })),
      });
    }
  }, [id, existing.data, c.rate]);

  if (id && existing.error) return <ErrorNote error={existing.error} retry={existing.reload} />;
  if (!f) return <Loading />;

  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setItem = (i, p) => set({ items: f.items.map((it, k) => (k === i ? { ...it, ...p } : it)) });
  const addItem = () => set({ items: [...f.items, blankLine(c)] });
  const delItem = (i) => set({ items: f.items.filter((_, k) => k !== i) });

  const clean = f.items.filter((i) => i.name.trim());
  const live = { ...f, items: clean.map((i) => (c.money ? { name: i.name, price: num(i.price), qty: num(i.qty) } : { name: i.name.trim() })) };
  const totals = c.money ? proformaTotals(live.items, f[c.rate]) : null;

  const save = async (e) => {
    e.preventDefault();
    if (!clean.length) { toast(t("ቢያንስ አንድ ዕቃ ያስገቡ።"), "err"); return; }
    const body = {
      y: num(f.y), m: num(f.m), d: num(f.d), client: f.client.trim(), items: live.items,
      ...(c.money ? { [c.rate]: num(f[c.rate]), terms: f.terms } : {}),
      ...(c.due ? { due_y: num(f.due_y), due_m: num(f.due_m), due_d: num(f.due_d) } : {}),
    };
    let saved;
    const ok = await run(async () => { saved = id ? await api.put(`${c.api}${id}/`, body) : await api.post(c.api, body); });
    if (ok) go(`${c.base}/${saved.id}`);
  };

  return (
    <>
      <PageHeader title={id ? t("አስተካክል · {n}", { n: pid(f.y, f.seq).replace("PF", c.prefix) }) : t(c.newTitle)}>
        <Button variant="ghost" icon="back" onClick={() => go(c.base)}>{t("ተመለስ")}</Button>
      </PageHeader>
      <div className="pf-editor">
        <form className="card form" onSubmit={save}>
          <Field label={t(c.clientLabel || "ደንበኛ (Invoice to)")}><input value={f.client} onChange={(e) => set({ client: e.target.value })} required /></Field>
          <DateField value={f} onChange={(v) => set({ y: v.y, m: v.m, d: v.d })} />
          {c.due && (
            <DateField label={t("መክፈያ ቀን (Payment Due)")} value={{ y: f.due_y, m: f.due_m, d: f.due_d }}
              onChange={(v) => set({ due_y: v.y, due_m: v.m, due_d: v.d })} />
          )}
          <div className="pf-lines">
            <span className="lbl muted" style={{ fontSize: 13, fontWeight: 500 }}>{t("ዕቃዎች")}</span>
            {c.money && <div className="pf-line head"><span>{t("ስም")}</span><span>{t("ዋጋ")}</span><span>{t("ብዛት")}</span><span /></div>}
            {f.items.map((it, i) => (
              <div className={`pf-line ${c.money ? "" : "one"}`} key={i}>
                <input placeholder={c.money ? "Item name" : "e.g. Roll-up banner × 2"} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
                {c.money && <input type="number" step="any" min="0" value={it.price} onChange={(e) => setItem(i, { price: e.target.value })} />}
                {c.money && <input type="number" step="any" min="0" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} />}
                <button type="button" className="icon-btn" aria-label={t("አስወግድ")} onClick={() => delItem(i)} disabled={f.items.length === 1}><Icon name="x" size={17} /></button>
              </div>
            ))}
            <div><Button type="button" size="sm" variant="ghost" icon="plus" onClick={addItem} disabled={!!c.maxItems && f.items.length >= c.maxItems}>{t("መስመር ጨምር")}</Button></div>
          </div>
          {c.money && (
            <>
              <Field label={c.rateLabel}><input type="number" step="any" min="0" max="100" value={f[c.rate]} onChange={(e) => set({ [c.rate]: e.target.value })} required /></Field>
              <Field label="Terms and conditions"><textarea value={f.terms} onChange={(e) => set({ terms: e.target.value })} /></Field>
              <div className="preview"><span>{c.totalLabel}</span><b>{fmt(totals.grand)} ETB</b></div>
            </>
          )}
          <div className="form-actions"><Button type="submit" disabled={busy}>{busy ? t("በማስቀመጥ ላይ…") : t("አስቀምጥና ክፈት")}</Button></div>
        </form>
        <div className="pf-preview">
          <ScaledSheet><ProformaSheet kind={kind} p={live} shop={settings} /></ScaledSheet>
        </div>
      </div>
    </>
  );
}
