import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api.js";
import { bi } from "../lib/bi.js";
import { useSubmit } from "../lib/forms.js";
import Icon from "./Icon.jsx";
import { Button, Field, PageHeader } from "./ui.jsx";

export const overlay = {
  position: "fixed", inset: 0, background: "rgba(2,6,23,.55)", backdropFilter: "blur(3px)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 16,
};

export function Popup({ onClose, onSubmit, children, width = 400 }) {
  const Tag = onSubmit ? "form" : "div";
  return (
    <div style={overlay} onClick={onClose}>
      <Tag className="card form" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit} style={{ width: "100%", maxWidth: width }}>
        {children}
      </Tag>
    </div>
  );
}

const LockIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
const TrashIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
);

/** ኮድ ውጭ (ያለ ልዩ provider) ዳያሎግ ለማሳየት */
function mount(render) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (value) => {
      resolve(value);
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
    };
    root.render(render(done));
  });
}

function useEscape(onEsc) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onEsc(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onEsc]);
}

function PasswordDialog({ title, onDone }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEscape(() => onDone(null));
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api.post("/auth/verify-password/", { password: pw });
      onDone(r.token);
    } catch (x) {
      setErr(x.message || bi("የይለፍ ቃሉ ትክክል አይደለም።", "Incorrect password."));
      setPw(""); setBusy(false);
    }
  };
  return (
    <Popup onClose={() => onDone(null)} onSubmit={submit}>
      <div style={{ textAlign: "center" }}>
        <div className="lock-ic"><LockIcon /></div>
        <h3 style={{ margin: "10px 0 4px" }}>{title}</h3>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{bi("ለመቀጠል የመለያዎን የይለፍ ቃል ያስገቡ።", "Enter your account password to continue.")}</p>
      </div>
      <Field label={bi("የይለፍ ቃል", "Password")}>
        <input type="password" autoFocus required autoComplete="current-password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} />
      </Field>
      {err && <div role="alert" style={{ color: "#dc2626", fontSize: 13, fontWeight: 600 }}>{err}</div>}
      <div className="form-actions">
        <Button variant="ghost" type="button" onClick={() => onDone(null)}>{bi("ተው", "Cancel")}</Button>
        <Button type="submit" disabled={busy}>{busy ? bi("በማረጋገጥ ላይ…", "Checking…") : bi("አረጋግጥ", "Confirm")}</Button>
      </div>
    </Popup>
  );
}

function ConfirmDialog({ title, text, okLabel, onDone }) {
  useEscape(() => onDone(false));
  return (
    <Popup onClose={() => onDone(false)}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      {text && <p className="muted" style={{ margin: 0 }}>{text}</p>}
      <div className="form-actions">
        <Button variant="ghost" type="button" onClick={() => onDone(false)}>{bi("ተው", "Cancel")}</Button>
        <Button variant="danger" type="button" onClick={() => onDone(true)}>{okLabel}</Button>
      </div>
    </Popup>
  );
}

const TITLES = {
  edit: () => bi("ለማስተካከል የይለፍ ቃልዎን ያስገቡ", "Enter your password to edit"),
  delete: () => bi("ለመሰረዝ የይለፍ ቃልዎን ያስገቡ", "Enter your password to delete"),
  pay: () => bi("ክፍያ ለመመዝገብ የይለፍ ቃልዎን ያስገቡ", "Enter your password to record a payment"),
};

/** የይለፍ ቃል ጠይቆ ትክክል ከሆነ token ይመልሳል፤ ከተሰረዘ null። kind: "edit" | "delete" */
export const askPassword = (kind = "edit") =>
  mount((done) => <PasswordDialog title={(TITLES[kind] || TITLES.edit)()} onDone={done} />);

export const askConfirm = ({ title, text, okLabel }) =>
  mount((done) => <ConfirmDialog title={title} text={text} okLabel={okLabel} onDone={done} />);

/** ለአገልጋዩ: ?at=<token> */
export const withAt = (path, token) =>
  `${path}${path.includes("?") ? "&" : "?"}at=${encodeURIComponent(token || "")}`;

/** ወደ ሌላ ገጽ (ሰነድ አርታኢ) የሚሄድ ማስተካከያ ፈቃድ */
const grants = new Map();
export const setGrant = (key, token) => grants.set(key, { token, at: Date.now() });
export const takeGrant = (key) => {
  const g = grants.get(key);
  return g && Date.now() - g.at < 25 * 60 * 1000 ? g.token : null;
};

/** ✎ — የይለፍ ቃል ከተረጋገጠ onGranted(token) */
export function GuardedEdit({ onGranted }) {
  return (
    <button type="button" className="icon-btn" aria-label={bi("አስተካክል", "Edit")}
      onClick={async () => { const tok = await askPassword("edit"); if (tok) onGranted(tok); }}>
      <Icon name="edit" size={17} />
    </button>
  );
}

/** 🗑 — የይለፍ ቃል → "እርግጠኛ ነዎት?" → onConfirm(token) */
export function GuardedDelete({ onConfirm, text }) {
  const click = async () => {
    const tok = await askPassword("delete");
    if (!tok) return;
    const ok = await askConfirm({
      title: bi("እርግጠኛ ነዎት?", "Are you sure?"),
      text: text || bi("ይህ መዝገብ ለዘላለም ይሰረዛል።", "This record will be permanently deleted."),
      okLabel: bi("አዎ፣ ሰርዝ", "Yes, delete"),
    });
    if (ok) onConfirm(tok);
  };
  return (
    <button type="button" className="icon-btn danger" aria-label={bi("ሰርዝ", "Delete")} onClick={click}><TrashIcon /></button>
  );
}

/** ባንክና ሪፖርት የሚጋሩት የይለፍ ቃል በር */
export function UnlockGate({ title, endpoint, onOpen }) {
  const [pw, setPw] = useState("");
  const [busy, run] = useSubmit();
  const submit = async (e) => {
    e.preventDefault();
    let tok = null;
    const ok = await run(async () => { const r = await api.post(endpoint, { password: pw }); tok = r?.token; }, "");
    if (ok && tok) onOpen(tok); else setPw("");
  };
  return (
    <>
      <PageHeader title={title} />
      <Popup onSubmit={submit}>
        <div style={{ textAlign: "center" }}>
          <div className="lock-ic"><LockIcon /></div>
          <h3 style={{ margin: "10px 0 4px" }}>{title}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{bi("ይህ ገጽ የተጠበቀ ነው። ለመክፈት የይለፍ ቃልዎን ያስገቡ።", "This page is protected. Enter your password to open it.")}</p>
        </div>
        <Field label={bi("የይለፍ ቃል", "Password")}>
          <input type="password" autoFocus required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <div className="form-actions">
          <Button variant="ghost" type="button" onClick={() => { window.location.hash = "/"; }}>{bi("ተመለስ", "Back")}</Button>
          <Button type="submit" disabled={busy}>{busy ? bi("በመክፈት ላይ…", "Unlocking…") : bi("ክፈት", "Unlock")}</Button>
        </div>
      </Popup>
    </>
  );
}

export function NoAccess() {
  return (
    <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <h2 style={{ margin: "0 0 6px" }}>{bi("ገጹ አልተገኘም", "Page not found")}</h2>
        <p className="muted" style={{ margin: 0 }}>{bi("ይህ ገጽ በመለያዎ አይገኝም።", "This page isn't available on your account.")}</p>
      </div>
    </div>
  );
}