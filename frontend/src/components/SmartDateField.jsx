import { useLang } from "../lib/hooks.jsx";
import { bi } from "../lib/bi.js";
import { ethToIso, isoToEth } from "../lib/ethiopian.js";
import { DateField as EthDateField, Field } from "./ui.jsx";

export default function SmartDateField({ value, onChange, label }) {
  const { lang } = useLang();
  if (lang !== "en") return <EthDateField value={value} onChange={onChange} label={label} />;
  const ok = value && value.y && value.m && value.d;
  return (
    <Field label={label || bi("ቀን", "Date")}>
      <input type="date" required value={ok ? ethToIso(value) : ""}
        onChange={(e) => { if (e.target.value) onChange(isoToEth(e.target.value)); }} />
    </Field>
  );
}