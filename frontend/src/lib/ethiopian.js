// የኢትዮጵያ አቆጣጠር (13 ወራት) — Django ከሚጠቀመው ስሌት ጋር አንድ ነው።
const MONTHS_AM = [
  "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት",
  "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን",
];
// English: Ethiopian months overlap two Gregorian months, so they are labelled by range.
const MONTHS_EN = [
  "Sep–Oct", "Oct–Nov", "Nov–Dec", "Dec–Jan", "Jan–Feb", "Feb–Mar", "Mar–Apr",
  "Apr–May", "May–Jun", "Jun–Jul", "Jul–Aug", "Aug–Sep", "Sep",
];
const GREG_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS_AM = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const MONTHS = [...MONTHS_AM];
export const WEEKDAYS = [...WEEKDAYS_AM];
let L = "am";
export function applyEthLang(lang) {
  L = lang;
  MONTHS.splice(0, MONTHS.length, ...(lang === "en" ? MONTHS_EN : MONTHS_AM));
  WEEKDAYS.splice(0, WEEKDAYS.length, ...(lang === "en" ? WEEKDAYS_EN : WEEKDAYS_AM));
}
export const getEthLang = () => L;

const EPOCH = 1723856;

function gregorianToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) -
    Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  );
}

export function fromGregorian(date = new Date()) {
  const j = gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate()) - EPOCH;
  const r = ((j % 1461) + 1461) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    y: 4 * Math.floor(j / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    m: Math.floor(n / 30) + 1,
    d: (n % 30) + 1,
  };
}

/** ኢትዮጵያ {y,m,d} → የግሪጎሪያን Date (ትክክለኛ ቀን) */
export function ethToGregorian({ y, m, d }) {
  const j = 365 * y + Math.floor(y / 4) + 30 * (m - 1) + (d - 1);
  const jdn = EPOCH + j;
  const f = jdn + 1401 + Math.floor((Math.floor((4 * jdn + 274277) / 146097) * 3) / 4) - 38;
  const e = 4 * f + 3;
  const g = Math.floor((e % 1461) / 4);
  const h = 5 * g + 2;
  const D = Math.floor((h % 153) / 5) + 1;
  const M = ((Math.floor(h / 153) + 2) % 12) + 1;
  const Y = Math.floor(e / 1461) - 4716 + Math.floor((14 - M) / 12);
  return new Date(Y, M - 1, D);
}

const pad = (n) => String(n).padStart(2, "0");
export const ethToIso = (o) => {
  const g = ethToGregorian(o);
  return `${g.getFullYear()}-${pad(g.getMonth() + 1)}-${pad(g.getDate())}`;
};
export const isoToEth = (iso) => {
  const [Y, M, D] = iso.split("-").map(Number);
  return fromGregorian(new Date(Y, M - 1, D));
};

export const todayEth = () => fromGregorian(new Date());
export const maxDay = (y, m) => (m === 13 ? (y % 4 === 3 ? 6 : 5) : 30);

/** ሁልጊዜ የግሪጎሪያን (ፕሮፎርማ፣ የክፍያ ጥያቄ፣ የማድረሻ ሰነድ) — "12 Oct 2026" */
export const dstrGreg = (o) => {
  if (!o || !o.y || !o.m || !o.d) return "—";
  const g = ethToGregorian(o);
  return Number.isNaN(g.getTime()) ? "—" : `${g.getDate()} ${GREG_MONTHS[g.getMonth()]} ${g.getFullYear()}`;
};

/** አማርኛ ሲሆን የኢትዮጵያ ቀን፤ English ሲሆን የግሪጎሪያን */
export const dstr = (o) => (L === "en" ? dstrGreg(o) : `${o.d} ${MONTHS[o.m - 1]} ${o.y}`);

export function weekdayLabel(date = new Date()) {
  return WEEKDAYS[date.getDay()];
}

export function dateError({ y, m, d }) {
  y = Number(y); m = Number(m); d = Number(d);
  const en = L === "en";
  if (!y || y < 1990 || y > 2100) return en ? "Invalid year." : "ዓ.ም ትክክል አይደለም።";
  if (!m || m < 1 || m > 13) return en ? "Choose a month." : "ወር ይምረጡ።";
  if (!d || d < 1 || d > maxDay(y, m)) {
    return en
      ? `Invalid day (${MONTHS[m - 1]} has only ${maxDay(y, m)} days).`
      : `ቀኑ ትክክል አይደለም (${MONTHS[m - 1]} እስከ ${maxDay(y, m)} ቀን ብቻ አለው)።`;
  }
  return null;
}