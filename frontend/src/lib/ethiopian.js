// የኢትዮጵያ አቆጣጠር (13 ወራት) — Django ከሚጠቀመው ስሌት ጋር አንድ ነው።
const MONTHS_AM = [
  "መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት",
  "ሚያዝያ", "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜን",
];
const MONTHS_EN = [
  "Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit",
  "Miazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume",
];
const WEEKDAYS_AM = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "አርብ", "ቅዳሜ"];
const WEEKDAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ቋንቋ ሲቀየር በቦታው ይለወጣሉ (i18n.js ይጠራዋል) — ስለዚህ እንደ ድርድር መጠቀም ይቻላል።
export const MONTHS = [...MONTHS_AM];
export const WEEKDAYS = [...WEEKDAYS_AM];
let L = "am";
export function applyEthLang(lang) {
  L = lang;
  MONTHS.splice(0, MONTHS.length, ...(lang === "en" ? MONTHS_EN : MONTHS_AM));
  WEEKDAYS.splice(0, WEEKDAYS.length, ...(lang === "en" ? WEEKDAYS_EN : WEEKDAYS_AM));
}

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

export const todayEth = () => fromGregorian(new Date());

export const maxDay = (y, m) => (m === 13 ? (y % 4 === 3 ? 6 : 5) : 30);

export const dstr = (o) => `${o.d} ${MONTHS[o.m - 1]} ${o.y}`;

export function weekdayLabel(date = new Date()) {
  return WEEKDAYS[date.getDay()];
}

/** ቀኑ ትክክል ካልሆነ የስህተት መልዕክት፣ ትክክል ከሆነ null */
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
