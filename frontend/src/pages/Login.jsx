import { useState } from "react";
import { t } from "../lib/i18n.js";
import { api, setToken } from "../lib/api.js";
import { Button, Field, ErrorNote } from "../components/ui.jsx";
import LangToggle from "../components/LangToggle.jsx";

export default function Login({ onDone }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.post("/auth/login/", f);
      setToken(r.token);
      window.location.hash = "/";
      onDone();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-lang"><LangToggle /></div>
      <form className="card login-card form" onSubmit={submit}>
        <div className="brand"><div className="mark">{t("ደ")}</div><span>{t("ዲጂታል የሱቅ ደብተር")}</span></div>
        <h1>{t("እንኳን ደህና መጡ")}</h1>
        <Field label={t("የተጠቃሚ ስም")}>
          <input autoFocus autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
        </Field>
        <Field label={t("የይለፍ ቃል")}>
          <input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        </Field>
        <ErrorNote error={err} />
        <Button type="submit" disabled={busy}>{busy ? t("በመግባት ላይ…") : t("ግባ")}</Button>
      </form>
    </div>
  );
}
