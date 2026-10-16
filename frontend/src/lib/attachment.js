const pad = (n) => String(n).padStart(2, "0");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** አሁን ያለው ቀንና ሰዓት: "2026-10-16 12:00:19" */
export const nowStamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** "2026-10-16 12:00:19" -> "16-Oct-26 12:00:19" */
export const fmtIssued = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(s || "");
  return m ? `${m[3]}-${MON[Number(m[2]) - 1]}-${m[1].slice(2)} ${m[4]}` : (s || "");
};

/** <input type="datetime-local"> conversions */
export const toInput = (s) => (s || "").replace(" ", "T");
export const fromInput = (v) => {
  if (!v) return "";
  const x = v.replace("T", " ");
  return x.length === 16 ? `${x}:00` : x;
};