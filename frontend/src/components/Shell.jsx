import { useState } from "react";
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
  const [collapsed, setCollapsed] = useState(false);
  const name = settings?.name || t("የሱቅ ደብተር");
  const NAV = nav();
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="side">
        <div className="brand">
          <div className="mark">{name.slice(0, 1)}</div>
          <span className="lbl">{name}</span>
          <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label="Collapse menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.to} href={`#${n.to}`} title={n.label} className={active(path, n.to) ? "on" : ""} onClick={() => setCollapsed(true)}>
              <Icon name={n.icon} /><span className="lbl">{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-lang"><LangToggle /></div>
          <button className="nav-btn" title={theme === "dark" ? t("ብርሃን") : t("ጨለማ")} onClick={onTheme}>
            <Icon name={theme === "dark" ? "sun" : "moon"} /><span className="lbl">{theme === "dark" ? t("ብርሃን") : t("ጨለማ")}</span>
          </button>
          <button className="nav-btn" title={t("ውጣ")} onClick={onLogout}>
            <Icon name="logout" /><span className="lbl">{t("ውጣ")}</span>
          </button>
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