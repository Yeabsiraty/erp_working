import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

/* ---------- ቀላል hash router ---------- */
const read = () => window.location.hash.slice(1) || "/";

export function useHashPath() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => { setPath(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}
export const go = (to) => { window.location.hash = to; };

/* ---------- ዳታ ማምጫ ---------- */
export function useResource(path, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path == null) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    api.get(path)
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ ...s, loading: false, error })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/* ---------- ማሳወቂያ (toast) ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const remove = useCallback((id) => setToasts((l) => l.filter((x) => x.id !== id)), []);
  // type: "ok" (green) | "edit" (yellow) | "del" (red) | "err" (red)
  const show = useCallback((message, type = "ok") => {
    const id = ++idRef.current;
    const ms = type === "err" ? 5000 : 3000;
    setToasts((l) => [...l, { id, message, type, ms }]); // new one goes to the bottom
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-stack">
        {toasts.map((x) => (
          <div className={`toast ${x.type}`} role="status" key={x.id}>
            <span>{x.message}</span>
            <i className="toast-bar" style={{ animationDuration: `${x.ms}ms` }} onAnimationEnd={() => remove(x.id)} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- ቅንብር (የሱቅ ስም፣ ፕሮፎርማ መረጃ) ---------- */
export const SettingsCtx = createContext({ settings: null, reload: () => {} });
export const useSettings = () => useContext(SettingsCtx);

/* ---------- ገጽታ (ብርሃን / ጨለማ) ---------- */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const t = document.documentElement.getAttribute("data-theme");
    return t || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("ledger_theme", next); } catch { /* ignore */ }
    setTheme(next);
  };
  return [theme, toggle];
}

/* ---------- ቋንቋ (አማርኛ ↔ English) ---------- */
export const LangCtx = createContext({ lang: "am", setLang: () => {} });
export const useLang = () => useContext(LangCtx);
