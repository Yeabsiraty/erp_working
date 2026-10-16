import { useEffect, useState } from "react";
import { api } from "./api.js";

let cache = null;
let inflight = null;
const subs = new Set();

export function clearMe() {
  cache = null;
  inflight = null;
  subs.forEach((f) => f(null));
}
window.addEventListener("auth:logout", clearMe);

function load() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api.get("/auth/me/").then((u) => { cache = u; return u; }).finally(() => { inflight = null; });
  }
  return inflight;
}

/** { username, is_superuser, is_staff } ወይም null (እስኪጫን) */
export function useMe() {
  const [me, setMe] = useState(cache);
  useEffect(() => {
    let alive = true;
    subs.add(setMe);
    if (!cache) load().then((u) => alive && setMe(u)).catch(() => {});
    return () => { alive = false; subs.delete(setMe); };
  }, []);
  return me;
}