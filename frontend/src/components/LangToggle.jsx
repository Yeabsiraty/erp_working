import { useLang } from "../lib/hooks.jsx";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button className={lang === "am" ? "on" : ""} onClick={() => setLang("am")} aria-pressed={lang === "am"}>አማ</button>
      <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} aria-pressed={lang === "en"}>EN</button>
    </div>
  );
}
