import { useEffect, useState } from "react";
import { bi } from "../lib/bi.js";
import { MONTHS, dstr, maxDay, todayEth } from "../lib/ethiopian.js";
import { fmt, fmt0 } from "../lib/format.js";
import { useMe } from "../lib/me.js";
import { useResource, useSettings } from "../lib/hooks.jsx";
import SmartDateField from "../components/SmartDateField.jsx";
import { NoAccess, UnlockGate } from "../components/Guard.jsx";
import { Button, Card, ErrorNote, Field, Loading, PageHeader } from "../components/ui.jsx";

const KEYS = ["summary", "sales", "purchases", "stock", "debts", "expenses", "bank"];
const sectionLabel = (k) => ({
  summary: bi("ማጠቃለያ", "Summary"), sales: bi("ሽያጭ", "Sales"), purchases: bi("ግዢዎች", "Purchases"),
  stock: bi("ክምችት", "Stock"), debts: bi("ዕዳ", "Debts"), expenses: bi("ወጪ", "Expenses"), bank: bi("ባንክ", "Bank"),
}[k]);

const ymd = (o) => `${o.y}-${o.m}-${o.d}`;
const monthLabel = (y, m) => bi(`${MONTHS[m - 1]} ${y}`, `${MONTHS[m - 1]} (EC ${y})`);
const numCol = (label, f, digits = 2) => ({ label, num: true, get: (r) => (digits === 0 ? fmt0(f(r)) : fmt(f(r))), raw: (r) => Number(f(r)) || 0 });
const txtCol = (label, f) => ({ label, get: f, raw: f });
const sumOf = (rows, f) => rows.reduce((a, r) => a + (Number(f(r)) || 0), 0);
const saleStatus = (r) => (r.type !== "credit" ? bi("ጥሬ", "Cash") : r.settled ? bi("የተከፈለ", "Paid") : `${bi("ዱቤ", "Credit")} (${fmt(r.balance)})`);

function groupBy(rows, keyOf, labelOf, fields, byKey) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyOf(r);
    const g = map.get(k) || { k, label: labelOf(r), n: 0, ...Object.fromEntries(fields.map((f) => [f, 0])) };
    g.n += 1;
    fields.forEach((f) => { g[f] += Number(r[f]) || 0; });
    map.set(k, g);
  });
  const arr = [...map.values()];
  return byKey ? arr.sort((a, b) => (a.k > b.k ? 1 : -1)) : arr.sort((a, b) => b[fields[0]] - a[fields[0]]);
}

/** ከአገልጋዩ የመጣውን መረጃ ወደ ሠንጠረዦች ይቀይራል (ለማሳያም ለCSVም አንድ ምንጭ) */
function build(d, o) {
  const B = [];
  if (d.summary) {
    const s = d.summary;
    B.push({
      id: "summary", title: sectionLabel("summary"), kpis: [
        [bi("ጠቅላላ ሽያጭ", "Total sales"), s.sales], [bi("የዕቃ ዋጋ", "Cost of goods"), s.cost], [bi("ጠቅላላ ትርፍ", "Gross profit"), s.gross],
        [bi("ወጪ", "Expenses"), s.expenses], [bi("የተጣራ ትርፍ", "Net profit"), s.net], [bi("ግዢ", "Purchases"), s.purchases],
        [bi("ጥሬ ሽያጭ", "Cash sales"), s.cash_sales], [bi("ዱቤ ሽያጭ", "Credit sales"), s.credit_sales], [bi("ቅድመ ክፍያ", "Down payments"), s.upfront],
        [bi("የተሰበሰበ ዕዳ", "Debt collected"), s.collected], [bi("ወደ ባንክ የገባ", "Added to bank"), s.deposits],
        [bi("የሽያጭ ብዛት", "Number of sales"), s.sales_count, true],
        [bi("የክምችት ዋጋ (አሁን)", "Stock value (now)"), s.stock_value], [bi("ጠቅላላ ዕዳ (አሁን)", "Total debt (now)"), s.debt_total],
      ],
    });
  }
  if (d.sales) {
    const rows = d.sales;
    const tables = [];
    if (o.gs !== "none") {
      const by = {
        day: [(r) => r.y * 10000 + r.m * 100 + r.d, (r) => dstr(r), true, bi("ቀን", "Date")],
        month: [(r) => r.y * 100 + r.m, (r) => monthLabel(r.y, r.m), true, bi("ወር", "Month")],
        item: [(r) => r.item, (r) => r.item, false, bi("ዕቃ", "Item")],
        customer: [(r) => r.customer || "—", (r) => r.customer || bi("ጥሬ (ደንበኛ የለም)", "Cash (no customer)"), false, bi("ደንበኛ", "Customer")],
        type: [(r) => r.type, (r) => (r.type === "credit" ? bi("ዱቤ", "Credit") : bi("ጥሬ", "Cash")), false, bi("አይነት", "Type")],
      }[o.gs];
      const g = groupBy(rows, by[0], by[1], ["total", "profit", "qty"], by[2]);
      tables.push({
        title: `${bi("በ", "By ")}${by[3]}`,
        cols: [txtCol(by[3], (r) => r.label), numCol(bi("ግብይት", "Count"), (r) => r.n, 0), numCol(bi("ብዛት", "Qty"), (r) => r.qty, 0), numCol(bi("ጠቅላላ", "Total"), (r) => r.total), numCol(bi("ትርፍ", "Profit"), (r) => r.profit)],
        rows: g, foot: [bi("ድምር", "Total"), fmt0(sumOf(g, (r) => r.n)), fmt0(sumOf(g, (r) => r.qty)), fmt(sumOf(g, (r) => r.total)), fmt(sumOf(g, (r) => r.profit))],
      });
    }
    if (o.detail || o.gs === "none") {
      tables.push({
        title: o.gs !== "none" ? bi("ዝርዝር", "Details") : "",
        cols: [txtCol(bi("ቀን", "Date"), (r) => dstr(r)), txtCol(bi("ዕቃ", "Item"), (r) => r.item), numCol(bi("ብዛት", "Qty"), (r) => r.qty, 0), numCol(bi("ዋጋ", "Price"), (r) => r.price),
          numCol(bi("ጠቅላላ", "Total"), (r) => r.total), numCol(bi("ትርፍ", "Profit"), (r) => r.profit), txtCol(bi("ክፍያ", "Payment"), saleStatus), txtCol(bi("ደንበኛ", "Customer"), (r) => r.customer || "—")],
        rows, foot: [bi("ድምር", "Total"), "", "", "", fmt(sumOf(rows, (r) => r.total)), fmt(sumOf(rows, (r) => r.profit)), "", ""],
      });
    }
    B.push({ id: "sales", title: sectionLabel("sales"), tables });
  }
  if (d.purchases) {
    const rows = d.purchases;
    B.push({
      id: "purchases", title: sectionLabel("purchases"), tables: [{
        cols: [txtCol(bi("ቀን", "Date"), (r) => dstr(r)), txtCol(bi("ዕቃ", "Item"), (r) => r.item), txtCol(bi("አቅራቢ", "Supplier"), (r) => r.supplier || "—"),
          numCol(bi("ብዛት", "Qty"), (r) => r.qty, 0), numCol(bi("ዋጋ", "Price"), (r) => r.price), numCol(bi("ጠቅላላ", "Total"), (r) => r.total)],
        rows, foot: [bi("ድምር", "Total"), "", "", "", "", fmt(sumOf(rows, (r) => r.total))],
      }],
    });
  }
  if (d.stock) {
    const rows = d.stock;
    const status = (r) => ({ ok: bi("በቂ", "In stock"), low: bi("ሊያልቅ ነው", "Low"), out: bi("አልቋል", "Out") }[r.status]);
    B.push({
      id: "stock", title: sectionLabel("stock"), tables: [{
        cols: [txtCol(bi("ዕቃ", "Item"), (r) => r.name), numCol(bi("ቀሪ", "Left"), (r) => r.left, 0), txtCol(bi("መለኪያ", "Unit"), (r) => r.unit || ""), txtCol(bi("ሁኔታ", "Status"), status),
          numCol(bi("መግዣ", "Buy"), (r) => r.buy), numCol(bi("መሸጫ", "Sell"), (r) => r.sell), numCol(bi("በወቅቱ የተገዛ", "Bought (period)"), (r) => r.period_bought, 0),
          numCol(bi("በወቅቱ የተሸጠ", "Sold (period)"), (r) => r.period_sold, 0), numCol(bi("የክምችት ዋጋ", "Stock value"), (r) => r.value)],
        rows, foot: [bi("ድምር", "Total"), "", "", "", "", "", "", "", fmt(sumOf(rows, (r) => r.value))],
      }],
    });
  }
  if (d.debts) {
    const cs = d.debts.customers;
    const tables = [{
      title: bi("ደንበኞች", "Customers"),
      cols: [txtCol(bi("ደንበኛ", "Customer"), (r) => r.name), txtCol(bi("ስልክ", "Phone"), (r) => r.phone || "—"), numCol(bi("ዱቤ", "Credit"), (r) => r.credit),
        numCol(bi("የተከፈለ", "Paid"), (r) => Number(r.upfront) + Number(r.paid)), numCol(bi("ቀሪ", "Balance"), (r) => r.balance)],
      rows: cs, foot: [bi("ድምር", "Total"), "", fmt(sumOf(cs, (r) => r.credit)), fmt(sumOf(cs, (r) => Number(r.upfront) + Number(r.paid))), fmt(sumOf(cs, (r) => r.balance))],
    }];
    if (o.detail) {
      const ps = d.debts.payments;
      tables.push({
        title: bi("የተቀበሉ ክፍያዎች", "Payments received"),
        cols: [txtCol(bi("ቀን", "Date"), (r) => dstr(r)), txtCol(bi("ደንበኛ", "Customer"), (r) => r.customer), txtCol(bi("ማስታወሻ", "Note"), (r) => r.note || "—"), numCol(bi("መጠን", "Amount"), (r) => r.amount)],
        rows: ps, foot: [bi("ድምር", "Total"), "", "", fmt(sumOf(ps, (r) => r.amount))],
      });
    }
    B.push({ id: "debts", title: sectionLabel("debts"), tables });
  }
  if (d.expenses) {
    const rows = d.expenses;
    const tables = [];
    if (o.ge !== "none") {
      const by = {
        cat: [(r) => r.cat, (r) => r.cat, false, bi("ዓይነት", "Category")],
        month: [(r) => r.y * 100 + r.m, (r) => monthLabel(r.y, r.m), true, bi("ወር", "Month")],
        day: [(r) => r.y * 10000 + r.m * 100 + r.d, (r) => dstr(r), true, bi("ቀን", "Date")],
      }[o.ge];
      const g = groupBy(rows, by[0], by[1], ["amount"], by[2]);
      tables.push({
        title: `${bi("በ", "By ")}${by[3]}`,
        cols: [txtCol(by[3], (r) => r.label), numCol(bi("ብዛት", "Count"), (r) => r.n, 0), numCol(bi("መጠን", "Amount"), (r) => r.amount)],
        rows: g, foot: [bi("ድምር", "Total"), fmt0(sumOf(g, (r) => r.n)), fmt(sumOf(g, (r) => r.amount))],
      });
    }
    if (o.detail || o.ge === "none") {
      tables.push({
        title: o.ge !== "none" ? bi("ዝርዝር", "Details") : "",
        cols: [txtCol(bi("ቀን", "Date"), (r) => dstr(r)), txtCol(bi("ዓይነት", "Category"), (r) => r.cat), txtCol(bi("ማስታወሻ", "Note"), (r) => r.note || "—"), numCol(bi("መጠን", "Amount"), (r) => r.amount)],
        rows, foot: [bi("ድምር", "Total"), "", "", fmt(sumOf(rows, (r) => r.amount))],
      });
    }
    B.push({ id: "expenses", title: sectionLabel("expenses"), tables });
  }
  if (d.bank) {
    const rows = d.bank;
    B.push({
      id: "bank", title: sectionLabel("bank"), tables: [{
        cols: [txtCol(bi("ቀን", "Date"), (r) => dstr(r)), numCol(bi("ገንዘብ", "Amount"), (r) => r.amount),
          txtCol(bi("አይነት", "Type"), (r) => (r.kind === "debt" ? bi("በዕዳ", "With debt") : bi("ያለ ዕዳ", "No debt"))),
          txtCol(bi("ሁኔታ", "Status"), (r) => (r.kind !== "debt" ? "—" : r.repaid ? `${bi("የተመለሰ", "Repaid")} ${dstr({ y: r.rep_y, m: r.rep_m, d: r.rep_d })}` : bi("ያልተመለሰ", "Not repaid"))),
          txtCol(bi("ምክንያት", "Reason"), (r) => r.reason || "—")],
        rows, foot: [bi("ድምር", "Total"), fmt(sumOf(rows, (r) => r.amount)), "", "", ""],
      }],
    });
  }
  return B;
}

function csvOf(blocks) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const out = [];
  blocks.forEach((b) => {
    out.push(esc(b.title));
    (b.kpis || []).forEach(([k, v]) => out.push(`${esc(k)},${Number(v) || 0}`));
    (b.tables || []).forEach((tb) => {
      if (tb.title) out.push(esc(tb.title));
      out.push(tb.cols.map((c) => esc(c.label)).join(","));
      tb.rows.forEach((r) => out.push(tb.cols.map((c) => esc(c.raw(r))).join(",")));
      out.push("");
    });
    out.push("");
  });
  return `\uFEFF${out.join("\r\n")}`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Tbl({ cols, rows, foot }) {
  if (!rows.length) return <p className="muted">{bi("በዚህ ጊዜ መረጃ የለም።", "No data for this period.")}</p>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead><tr>{cols.map((c) => <th key={c.label} className={c.num ? "num" : ""}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.label} className={c.num ? "num" : ""}>{c.get(r)}</td>)}</tr>)}</tbody>
        {foot && <tfoot><tr>{foot.map((v, i) => <td key={i} className={cols[i].num ? "num" : ""}>{v}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

export default function Report() {
  const me = useMe();
  const [token, setToken] = useState(null); // ገጹ ሲከፈት ሁልጊዜ የይለፍ ቃል ይጠየቃል
  useEffect(() => {
    if (!token) return undefined;
    const id = setTimeout(() => setToken(null), 14 * 60 * 1000);
    return () => clearTimeout(id);
  }, [token]);
  if (me && !me.is_superuser) return <NoAccess />;
  if (!token) return <UnlockGate title={bi("ሪፖርት", "Report")} endpoint="/auth/report-unlock/" onOpen={setToken} />;
  return <ReportInner token={token} onLock={() => setToken(null)} />;
}

function ReportInner({ token, onLock }) {
  const { settings } = useSettings();
  const now = todayEth();
  const [o, setO] = useState({
    from: { y: now.y, m: 1, d: 1 }, to: { ...now },
    sections: Object.fromEntries(KEYS.map((k) => [k, true])),
    item: "", customer: "", type: "", category: "", bank_kind: "", debt_status: "",
    gs: "none", ge: "none", detail: true, orient: "portrait", title: "", note: "",
  });
  const set = (p) => setO((x) => ({ ...x, ...p }));
  const items = useResource("/items/");
  const customers = useResource("/customers/");

  const keys = KEYS.filter((k) => o.sections[k]);
  const qsx = new URLSearchParams({
    rt: token, from: ymd(o.from), to: ymd(o.to), sections: keys.join(","),
    item: o.item, customer: o.customer, type: o.type, category: o.category.trim(), bank_kind: o.bank_kind, debt_status: o.debt_status,
  }).toString();
  const { data, loading, error, reload } = useResource(keys.length ? `/report/?${qsx}` : null);
  const blocks = data ? build(data, o) : [];

  const preset = (k) => {
    if (k === "month") set({ from: { y: now.y, m: now.m, d: 1 }, to: { ...now } });
    if (k === "year") set({ from: { y: now.y, m: 1, d: 1 }, to: { ...now } });
    if (k === "all") set({ from: { y: 1990, m: 1, d: 1 }, to: { ...now } });
    if (k === "last") {
      const [y, m] = now.m > 1 ? [now.y, now.m - 1] : [now.y - 1, 13];
      set({ from: { y, m, d: 1 }, to: { y, m, d: maxDay(y, m) } });
    }
  };
  const sel = (label, key, options) => (
    <Field label={label}>
      <select value={o[key]} onChange={(e) => set({ [key]: e.target.value })}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  );
  const A = [["", bi("ሁሉም", "All")]];

  return (
    <>
      <style>{`@media print { @page { size: A4 ${o.orient}; margin: 12mm; } }`}</style>
      <PageHeader title={bi("ሪፖርት", "Report")} subtitle={bi("የሚፈልጉትን መርጠው ሪፖርቱን ያዘጋጁ", "Choose what you need and build your report")}>
        <Button variant="ghost" onClick={onLock}>{bi("ቆልፍ", "Lock")}</Button>
      </PageHeader>

      <Card className="no-print">
        <div className="form rp-controls">
          <div className="rp-row">
            <SmartDateField label={bi("ከ", "From")} value={o.from} onChange={(v) => set({ from: v })} />
            <SmartDateField label={bi("እስከ", "To")} value={o.to} onChange={(v) => set({ to: v })} />
          </div>
          <div className="rp-chips">
            {[["month", bi("የዚህ ወር", "This month")], ["last", bi("ያለፈው ወር", "Last month")], ["year", bi("የዚህ ዓመት", "This year")], ["all", bi("ሁሉም ጊዜ", "All time")]].map(([k, l]) => (
              <button type="button" key={k} className="rp-chip" onClick={() => preset(k)}>{l}</button>
            ))}
          </div>

          <div>
            <span className="rp-label">{bi("የሚካተቱ ክፍሎች", "Sections to include")}</span>
            <div className="rp-chips">
              {KEYS.map((k) => (
                <label key={k} className="rp-check">
                  <input type="checkbox" checked={o.sections[k]} onChange={(e) => set({ sections: { ...o.sections, [k]: e.target.checked } })} /> {sectionLabel(k)}
                </label>
              ))}
            </div>
          </div>

          <div className="rp-grid">
            {sel(bi("ዕቃ", "Item"), "item", [...A, ...(items.data || []).map((i) => [String(i.id), i.name])])}
            {sel(bi("ደንበኛ", "Customer"), "customer", [...A, ...(customers.data || []).map((c) => [String(c.id), c.name])])}
            {sel(bi("የሽያጭ አይነት", "Sale type"), "type", [...A, ["cash", bi("ጥሬ", "Cash")], ["credit", bi("ዱቤ", "Credit")]])}
            {sel(bi("የዕዳ ሁኔታ", "Debt status"), "debt_status", [...A, ["owes", bi("ዕዳ ያለበት", "Unpaid")], ["clear", bi("የተከፈለ", "Paid")]])}
            {sel(bi("የባንክ አይነት", "Bank type"), "bank_kind", [...A, ["own", bi("ያለ ዕዳ", "No debt")], ["debt", bi("በዕዳ", "With debt")]])}
            <Field label={bi("የወጪ ዓይነት (ይፈልጉ)", "Expense category (contains)")}>
              <input value={o.category} onChange={(e) => set({ category: e.target.value })} />
            </Field>
            {sel(bi("ሽያጭ በ… ይደራጅ", "Group sales by"), "gs", [["none", bi("አይደራጅ", "No grouping")], ["day", bi("ቀን", "Day")], ["month", bi("ወር", "Month")], ["item", bi("ዕቃ", "Item")], ["customer", bi("ደንበኛ", "Customer")], ["type", bi("አይነት", "Type")]])}
            {sel(bi("ወጪ በ… ይደራጅ", "Group expenses by"), "ge", [["none", bi("አይደራጅ", "No grouping")], ["cat", bi("ዓይነት", "Category")], ["month", bi("ወር", "Month")], ["day", bi("ቀን", "Day")]])}
            {sel(bi("የገጽ አቅጣጫ (PDF)", "Page orientation (PDF)"), "orient", [["portrait", bi("ቁመት", "Portrait")], ["landscape", bi("አግድም", "Landscape")]])}
            <Field label={bi("የሪፖርት ርዕስ", "Report title")}><input value={o.title} onChange={(e) => set({ title: e.target.value })} /></Field>
          </div>
          <Field label={bi("ተጨማሪ ማስታወሻ", "Extra note")}><textarea value={o.note} onChange={(e) => set({ note: e.target.value })} /></Field>
          <label className="rp-check"><input type="checkbox" checked={o.detail} onChange={(e) => set({ detail: e.target.checked })} /> {bi("ዝርዝር መስመሮችን አሳይ", "Show detail rows")}</label>

          <div className="form-actions" style={{ flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={reload}>{bi("አድስ", "Refresh")}</Button>
            <Button variant="ghost" disabled={!blocks.length} onClick={() => download(`report-${ymd(o.from)}_${ymd(o.to)}.csv`, csvOf(blocks))}>{bi("Excel (CSV) አውርድ", "Download Excel (CSV)")}</Button>
            <Button icon="printer" disabled={!blocks.length} onClick={() => window.print()}>{bi("አትም / PDF አውርድ", "Print / Save as PDF")}</Button>
          </div>
        </div>
      </Card>

      <ErrorNote error={error} retry={reload} />
      {!keys.length ? <p className="muted no-print">{bi("ቢያንስ አንድ ክፍል ይምረጡ።", "Select at least one section.")}</p> : loading && !data ? <Loading /> : (
        <div className="report-sheet">
          <header className="rp-head">
            <h1>{o.title.trim() || bi("ሪፖርት", "Report")}</h1>
            <div>{settings?.name}</div>
            <div className="muted">{dstr(o.from)} — {dstr(o.to)} · {bi("የተዘጋጀው", "Generated")} {dstr(todayEth())}</div>
            {o.note.trim() && <p className="rp-note">{o.note}</p>}
          </header>
          {blocks.map((b) => (
            <section key={b.id} className="rp-sec">
              <h2>{b.title}</h2>
              {b.kpis && (
                <div className="rp-kpis">
                  {b.kpis.map(([k, v, isCount]) => (
                    <div key={k} className="rp-kpi"><span>{k}</span><b>{isCount ? fmt0(v) : fmt(v)}</b></div>
                  ))}
                </div>
              )}
              {(b.tables || []).map((tb, i) => (
                <div key={i}>
                  {tb.title && <h3>{tb.title}</h3>}
                  <Tbl cols={tb.cols} rows={tb.rows} foot={tb.foot} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}