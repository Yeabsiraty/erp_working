import { t } from "./i18n.js";

const BASE = "/api";
const KEY = "ledger_token";

let token = null;
try { token = localStorage.getItem(KEY); } catch { /* private mode */ }

export const getToken = () => token;
export function setToken(t) {
  token = t;
  try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** የ DRF የስህተት አካልን ወደ አንድ ሰው-ሊያነበው የሚችል መልዕክት ይቀይራል */
function collect(node, out) {
  if (node == null) return;
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => collect(n, out));
  else if (typeof node === "object") Object.values(node).forEach((n) => collect(n, out));
}
function messageFrom(data, status) {
  if (data && typeof data.detail === "string") return data.detail;
  const out = [];
  collect(data, out);
  if (out.length) return [...new Set(out)].join(" ");
  if (status === 0) return t("ከአገልጋዩ ጋር መገናኘት አልተቻለም።");
  return t("ስህተት ተፈጠረ ({s})።", { s: status });
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(messageFrom(null, 0), 0, null);
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event("auth:logout"));
    }
    throw new ApiError(messageFrom(data, res.status), res.status, data);
  }
  return data;
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b = {}) => request("POST", p, b),
  put: (p, b) => request("PUT", p, b),
  patch: (p, b) => request("PATCH", p, b),
  del: (p) => request("DELETE", p),
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== "" && v != null) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : "";
};
