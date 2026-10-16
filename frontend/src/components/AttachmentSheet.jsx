import { fmt, fmt0, proformaTotals, r2 } from "../lib/format.js";
import { fmtIssued } from "../lib/attachment.js";
import { amountInWords } from "../lib/words.js";

// ከላይ የሚታተመው ቋሚ ራስጌ — ለመቀየር እዚህ ያስተካክሉ
export const COMPANY = {
  name: "ABROS PRINT AND ADVERT",
  address: "A.A S/C YEKA W. 08 H.NO 007 MEGENAGNA ON MARATHON BLDG",
  tel: "TEL: +251955331533",
  tin: "TIN: 0056343267",
};
const MIN_ROWS = 9; // በምስሉ ላይ 9 ባዶ ረድፎች አሉ

const Row = ({ label, value }) => (
  <div className="att-box-row"><span>{label}</span><span>{value}</span></div>
);
const show = (v, f) => (Number(v) ? f(v) : "");

/** a = { issued, bill_to, tin, address, ref, fs_no, vat_rate, items:[{id,name,unit,qty,price}], totals? } */
export function AttachmentSheet({ a }) {
  const items = a.items || [];
  const totals = a.totals || proformaTotals(items, a.vat_rate);
  const blanks = Math.max(0, MIN_ROWS - items.length);
  const words = amountInWords(totals.grand);
  return (
    <main className="att-sheet">
      <div className="att-wm" aria-hidden="true">Attachment</div>

      <header className="att-head">
        <h1>{COMPANY.name}</h1>
        <p>{COMPANY.address}</p>
        <p>{COMPANY.tel}</p>
        <p>{COMPANY.tin}</p>
      </header>

      <section className="att-meta">
        <div className="att-boxes left">
          <Row label="Date" value={fmtIssued(a.issued)} />
          <Row label="Bill to" value={a.bill_to} />
          <Row label="TIN" value={a.tin} />
          <Row label="Address" value={a.address} />
        </div>
        <div className="att-boxes right">
          <Row label="Ref." value={a.ref} />
          <Row label="FS. NO" value={a.fs_no} />
        </div>
      </section>

      <table className="att-items">
        <colgroup><col style={{ width: "10%" }} /><col style={{ width: "44%" }} /><col style={{ width: "9%" }} /><col style={{ width: "9%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /></colgroup>
        <thead><tr><th>ID</th><th>Description</th><th>Un.</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>
          {items.map((it, i) => {
            const line = r2((Number(it.price) || 0) * (Number(it.qty) || 0));
            return (
              <tr key={i}>
                <td className="c">{it.id ?? ""}</td>
                <td className="l">{it.name}</td>
                <td className="c">{it.unit}</td>
                <td className="c">{show(it.qty, fmt0)}</td>
                <td className="r">{show(it.price, fmt)}</td>
                <td className="r">{show(line, fmt)}</td>
              </tr>
            );
          })}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`b${i}`}><td>&nbsp;</td><td /><td /><td /><td /><td /></tr>
          ))}
        </tbody>
      </table>

      <section className="att-bottom">
        <div className="att-left">
          <div>Payment Method</div>
          <div className="att-words">
            <span className="lbl">Amount in<br />Words</span>
            <span className="val">{words}</span>
          </div>
        </div>
        <table className="att-totals">
          <tbody>
            <tr><td>Subtotal</td><td className="r">{fmt(totals.sub)}</td></tr>
            <tr><td>VAT</td><td className="r">{fmt(totals.tot)}</td></tr>
            <tr><td>Grand Total</td><td className="r">{fmt(totals.grand)}</td></tr>
          </tbody>
        </table>
      </section>

      <footer className="att-foot">
        <div className="att-prep">Prepared by:</div>
        <div className="att-recv">
          <span>Recieved by: Name</span><i className="line" /><span>Signature</span>
        </div>
      </footer>
    </main>
  );
}