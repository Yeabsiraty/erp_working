import { useState } from "react";
import { useToast } from "./hooks.jsx";
import { t } from "./i18n.js";

/** ቅጽ ሲላክ: busy ሁኔታ + ስኬት/ስህተት መልዕክት። ሲሳካ true ይመልሳል። */
export function useSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg, type = "ok") => {
    setBusy(true);
    try {
      await fn();
      const msg = okMsg === undefined
        ? (type === "edit" ? t("በተሳካ ሁኔታ ተስተካክሏል") : t("በተሳካ ሁኔታ ተቀምጧል"))
        : okMsg;
      if (msg) toast(msg, type);
      return true;
    } catch (e) {
      toast(e.message, "err");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

export const num = (v) => (v === "" || v == null ? 0 : Number(v));
export const dateOf = (row) => ({ y: row.y, m: row.m, d: row.d });
