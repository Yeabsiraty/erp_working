const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

function below1000(n) {
  const out = [];
  if (n >= 100) { out.push(`${ONES[Math.floor(n / 100)]} Hundred`); n %= 100; }
  if (n >= 20) out.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  else if (n > 0) out.push(ONES[n]);
  return out.join(" ");
}

/** 1250.5 -> "One Thousand Two Hundred Fifty Birr and Fifty Cents Only" ("" when 0) */
export function amountInWords(value) {
  const total = Math.round((Number(value) || 0) * 100);
  if (total <= 0) return "";
  let birr = Math.floor(total / 100);
  const cents = total % 100;
  const parts = [];
  for (let i = 0; birr > 0; i += 1) {
    const chunk = birr % 1000;
    if (chunk) parts.unshift(below1000(chunk) + (SCALES[i] ? ` ${SCALES[i]}` : ""));
    birr = Math.floor(birr / 1000);
  }
  let out = `${parts.length ? parts.join(" ") : "Zero"} Birr`;
  if (cents) out += ` and ${below1000(cents)} Cents`;
  return `${out} Only`;
}