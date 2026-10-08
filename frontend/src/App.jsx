import { useEffect, useState } from "react";
import { getLang, setLang as applyLang } from "./lib/i18n.js";
import { api, getToken, setToken } from "./lib/api.js";
import { LangCtx, SettingsCtx, ToastProvider, useHashPath, useResource, useTheme } from "./lib/hooks.jsx";
import Shell from "./components/Shell.jsx";
import { Loading, ErrorNote } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Sales from "./pages/Sales.jsx";
import Stock from "./pages/Stock.jsx";
import Debts from "./pages/Debts.jsx";
import Expenses from "./pages/Expenses.jsx";
import { DocEditor, DocList, DocView } from "./pages/Documents.jsx";
import Settings from "./pages/Settings.jsx";
import Bank from "./pages/Bank.jsx";

function docRoute(path, kind, base) {
  if (path === base) return <DocList kind={kind} />;
  if (path === `${base}/new`) return <DocEditor kind={kind} />;
  let m = path.match(new RegExp(`^${base}/(\\d+)/edit$`));
  if (m) return <DocEditor kind={kind} id={m[1]} key={m[1]} />;
  m = path.match(new RegExp(`^${base}/(\\d+)$`));
  if (m) return <DocView kind={kind} id={m[1]} key={m[1]} />;
  return null;
}

function route(path) {
  const doc = docRoute(path, "proforma", "/proforma") || docRoute(path, "payment", "/payment") || docRoute(path, "delivery", "/delivery");
  if (doc) return doc;
  switch (path) {
    case "/sales": return <Sales />;
    case "/stock": return <Stock />;
    case "/debts": return <Debts />;
    case "/expenses": return <Expenses />;
    case "/bank": return <Bank />;
    case "/settings": return <Settings />;
    default: return <Dashboard />;
  }
}

function Authed({ onLogout }) {
  const path = useHashPath();
  const [theme, toggleTheme] = useTheme();
  const { data, error, loading, reload } = useResource("/settings/");
  const logout = async () => {
    try { await api.post("/auth/logout/"); } catch { /* ignore */ }
    onLogout();
  };
  if (loading && !data) return <Loading />;
  if (error && !data) return <div style={{ padding: 24 }}><ErrorNote error={error} retry={reload} /></div>;
  return (
    <SettingsCtx.Provider value={{ settings: data, reload }}>
      <Shell path={path} theme={theme} onTheme={toggleTheme} onLogout={logout}>
        {route(path)}
      </Shell>
    </SettingsCtx.Provider>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  useEffect(() => {
    const off = () => setAuthed(false);
    window.addEventListener("auth:logout", off);
    return () => window.removeEventListener("auth:logout", off);
  }, []);
  const logout = () => { setToken(null); setAuthed(false); };
  // ቋንቋ ሲቀየር ዛፉ በ key እንደገና ይሰራል — ሁሉም ጽሑፍ በአዲሱ ቋንቋ ይታያል።
  const [lang, setLangState] = useState(getLang());
  const setLang = (l) => { applyLang(l); setLangState(l); };
  return (
    <LangCtx.Provider value={{ lang, setLang }}>
      <ToastProvider>
        {authed ? <Authed key={lang} onLogout={logout} /> : <Login key={lang} onDone={() => setAuthed(true)} />}
      </ToastProvider>
    </LangCtx.Provider>
  );
}
