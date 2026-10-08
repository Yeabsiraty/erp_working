import { useLayoutEffect, useRef, useState } from "react";
import { dstr } from "../lib/ethiopian.js";
import { fmt, fmt0, pid, proformaTotals } from "../lib/format.js";

/** A4 ፕሮፎርማ ወረቀት (የ ABROS ቅርጽ)። */
export function ProformaSheet({ p, shop, kind = "proforma" }) {
  const pay = kind === "payment";
  const del = kind === "delivery";
  const items = p.items || [];
  const rate = pay ? p.vat_rate : p.tot_rate;
  const totals = p.totals || proformaTotals(items, rate);
  const prefix = del ? "DN" : pay ? "PR" : "PF";
  const blanks = Math.max(0, (del ? 10 : 5) - items.length);
  const number = p.number || (p.seq ? pid(p.y, p.seq).replace("PF", prefix) : `${prefix}-—`);
  const s = shop || {};
  return (
    <main className={`pf-sheet ${del ? "delivery" : ""} ${pay ? "payment" : ""}`}>
      <div className="deco brush" /><div className="deco clip" /><div className="deco dot-teal" /><div className="deco ring" />
      <div className="deco circle" /><div className="deco smudge" />
      <div className="deco dots"><i /><i /><i /><i /></div>
      <div className="deco pbar" />

      <header className="head">
        <div>
          <h1 className="am">{s.title_am}</h1>
          <div className="en">{s.title_en}</div>
        </div>
        <img className="logo" src="/logo.png" alt="ABROS Print Wear" />
      </header>

      <section className="meta">
        {del ? (
          <dl className="lined">
            <div><dt>Date</dt><dd>: <span>{dstr(p)}</span></dd></div>
            <div><dt>Customer</dt><dd>: <span>{p.client}</span></dd></div>
            <div><dt>Delivery No</dt><dd>: <span>{number}</span></dd></div>
          </dl>
        ) : (
          <dl>
            <div><dt>Date</dt><dd>: {dstr(p)}</dd></div>
            <div><dt>Invoice to</dt><dd>: {p.client}</dd></div>
            {pay && <div><dt>Payment Due</dt><dd>: {p.due_d ? dstr({ y: p.due_y, m: p.due_m, d: p.due_d }) : ""}</dd></div>}
            <div><dt>No.</dt><dd>: {number}</dd></div>
          </dl>
        )}
        <div className={`proforma ${pay ? "pay" : ""} ${del ? "del" : ""}`}>{del ? "DELIVERY NOTE" : pay ? "PAYMENT REQUEST" : "PROFORMA"}</div>
      </section>

      {del ? (
        <table className="items one">
          <thead><tr><th>Item</th></tr></thead>
          <tbody>
            {items.map((it, i) => <tr key={i}><td className="name">{it.name}</td></tr>)}
            {Array.from({ length: blanks }, (_, i) => <tr key={`b${i}`}><td>&nbsp;</td></tr>)}
          </tbody>
        </table>
      ) : (
        <>
          <table className="items">
            <thead><tr><th className="name">Item name</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="name">{it.name}</td>
                  <td className="num">{fmt(it.price)}</td>
                  <td className="num">{fmt0(it.qty)}</td>
                  <td className="num">{fmt((Number(it.price) || 0) * (Number(it.qty) || 0))}</td>
                </tr>
              ))}
              {Array.from({ length: blanks }, (_, i) => <tr key={`b${i}`}><td>&nbsp;</td><td /><td /><td /></tr>)}
            </tbody>
          </table>

          <section className="summary">
            <div className="terms">
              <h4>Terms and conditions</h4>
              <p>{p.terms || (pay ? s.pr_terms : s.terms)}</p>
            </div>
            <dl className="totals">
              <div><dt>Subtotal</dt><dd>{fmt(totals.sub)}</dd></div>
              <div><dt>{pay ? "VAT" : "VAT"}({fmt0(rate)}%)</dt><dd>{fmt(totals.tot)}</dd></div>
              <div className="grand"><dt>{pay ? "AMOUNT DUE" : "Grand Total"}</dt><dd>{fmt(totals.grand)} <small>ETB</small></dd></div>
            </dl>
          </section>
        </>
      )}

      <footer className="foot">
        <img className="stamp" src="/stamp.png" alt="" />
        <ul className="contact">
          <li><span className="ico">✉</span>{s.website}</li>
          <li><span className="ico">✆</span>{s.phone}</li>
          <li><span className="ico" />{s.handle}</li>
        </ul>
        <div className={`signer ${del ? "line" : ""}`}><b>{s.signer}</b><span>{s.signer_role}</span></div>
        <div className="follow">Follow our social media <b>{s.social}</b></div>
      </footer>
    </main>
  );
}

/** ወረቀቱን ከመያዣው ስፋት ጋር የሚያሳንስ (ለስልክና ለቅድመ-እይታ) */
export function ScaledSheet({ children }) {
  const wrap = useRef(null);
  const inner = useRef(null);
  const [s, setS] = useState({ scale: 1, h: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!wrap.current || !inner.current) return;
      const sc = Math.min(1, wrap.current.clientWidth / inner.current.offsetWidth);
      setS({ scale: sc, h: inner.current.offsetHeight * sc });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap.current);
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="pf-scale" ref={wrap} style={{ height: s.h || undefined }}>
      <div className="pf-inner" ref={inner} style={{ width: "210mm", transform: `scale(${s.scale})` }}>
        {children}
      </div>
    </div>
  );
}
