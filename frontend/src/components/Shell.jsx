import Icon from "./Icon.jsx";
import { t } from "../lib/i18n.js";
import { useSettings } from "../lib/hooks.jsx";
import LangToggle from "./LangToggle.jsx";

const nav = () => [
  { to: "/", icon: "dashboard", label: t("ዳሽቦርድ") },
  { to: "/sales", icon: "sales", label: t("ሽያጭ") },
  { to: "/stock", icon: "stock", label: t("ክምችት") },
  { to: "/debts", icon: "debts", label: t("ዕዳ") },
  { to: "/expenses", icon: "expenses", label: t("ወጪ") },
  { to: "/proforma", icon: "proforma", label: t("ፕሮፎርማ") },
  { to: "/payment", icon: "payment", label: t("የክፍያ ጥያቄ") },
  { to: "/delivery", icon: "delivery", label: t("የማድረሻ ሰነድ") },
  { to: "/bank", icon: "payment", label: t("ባንክ") },
  { to: "/settings", icon: "settings", label: t("ቅንብር") },
];

const active = (path, to) => (to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`));

export default function Shell({ path, theme, onTheme, onLogout, children }) {
  const { settings } = useSettings();
  const name = settings?.name || t("የሱቅ ደብተር");
  const NAV = nav();
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><div className="mark">{name.slice(0, 1)}</div><span>{name}</span></div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} className={active(path, n.to) ? "on" : ""}>
              <Icon name={n.icon} />{n.label}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <LangToggle />
          <button className="nav-btn" onClick={onTheme}><Icon name={theme === "dark" ? "sun" : "moon"} />{theme === "dark" ? t("ብርሃን") : t("ጨለማ")}</button>
          <button className="nav-btn" onClick={onLogout}><Icon name="logout" />{t("ውጣ")}</button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar no-print">
          <div className="brand"><div className="mark">{name.slice(0, 1)}</div><span>{name}</span></div>
          <div className="tools">
            <LangToggle />
            <button className="icon-btn" onClick={onTheme} aria-label="Theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
          </div>
        </div>
        {children}
      </main>
      <nav className="bottom-nav">
        {NAV.map((n) => (
          <a key={n.to} href={`#${n.to}`} className={active(path, n.to) ? "on" : ""}>
            <Icon name={n.icon} size={21} />{n.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
