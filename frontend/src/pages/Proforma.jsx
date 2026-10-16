import { useState } from "react";
import { t } from "../lib/i18n.js";
import { bi } from "../lib/bi.js";
import { api } from "../lib/api.js";
import { dstr } from "../lib/ethiopian.js";
import { fmt } from "../lib/format.js";
import { copyText } from "../lib/clip.js";
import { go, useResource, useToast } from "../lib/hooks.jsx";
import Icon from "../components/Icon.jsx";
import { GuardedDelete, GuardedEdit, setGrant, withAt } from "../components/Guard.jsx";
import { ALL, FilterSelect, SearchBar, Toolbar, hit } from "../components/ListTools.jsx";
import { Button, Card, Empty, ErrorNote, Loading, PageHeader } from "../components/ui.jsx";
import { DOCS } from "./Documents.jsx";
import { AttachmentTable } from "./Attachments.jsx";

export default function ProformaPage() {
  const c = DOCS.proforma;
  const toast = useToast();
  const { data, loading, error, reload } = useResource(c.api);

  // search + filter of the PROFORMA table only (the attachment table has its own)
  const [search, setSearch] = useState("");
  const [yearF, setYearF] = useState("all");

  const all = data || [];
  const years = [...new Set(all.map((p) => p.y))].sort((a, b) => b - a);
  const rows = all.filter((p) => {
    if (yearF !== "all" && String(p.y) !== yearF) return false;
    return hit(search, p.client, p.number);
  });
  const filtering = !!search || yearF !== "all";
  const resetFilters = () => { setSearch(""); setYearF("all"); };

  const remove = async (id, token) => {
    try { await api.del(withAt(`${c.api}${id}/`, token)); toast(t("ተሰርዟል"), "del"); reload(); } catch (e) { toast(e.message, "err"); }
  };
  const copy = async (id) => {
    const ok = await copyText(String(id));
    toast(ok ? bi("ተቀድቷል", "Copied") : bi("መቅዳት አልተቻለም", "Copy failed"), ok ? "ok" : "err");
  };

  return (
    <>
      <PageHeader title={bi("ፕሮፎርማ እና አባሪ", "Proforma & Attachment")} subtitle={t("{n} ሰነዶች", { n: rows.length })}>
        <Button variant="ghost" icon="plus" onClick={() => go("/attachment/new")}>{bi("አዲስ አባሪ", "New attachment")}</Button>
        <Button icon="plus" onClick={() => go(`${c.base}/new`)}>{t(c.newTitle)}</Button>
      </PageHeader>
      <ErrorNote error={error} retry={reload} />

      <Toolbar active={filtering} onReset={resetFilters}>
        <SearchBar value={search} onChange={setSearch} placeholder={bi("ደንበኛ ወይም ቁጥር ፈልግ…", "Search customer or No.…")} />
        <FilterSelect label={t("ዓ.ም")} value={yearF} onChange={setYearF} options={[
          ALL(), ...years.map((y) => ({ value: String(y), label: String(y) })),
        ]} />
      </Toolbar>

      <Card flush>
        {loading && !data ? <Loading /> : rows.length === 0 ? (
          <Empty>{filtering ? bi("ከፍለጋው ጋር የሚመሳሰል የለም።", "Nothing matches your search.") : t("ገና ሰነድ አልተፈጠረም።")}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th>{t("ቁጥር")}</th><th>{t("ቀን")}</th><th>{t("ደንበኛ")}</th>
                  <th>{bi("አባሪ", "Attachment")}</th>
                  <th className="num">{t("ጠቅላላ")}</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="strong"><a href={`#${c.base}/${p.id}`}>{p.number}</a></td>
                    <td className="muted">{dstr(p)}</td>
                    <td>{p.client}</td>
                    <td>
                      {p.attachment_id ? (
                        <span className="att-ref">
                          <a href={`#/attachment/${p.attachment_id}`} title={bi("አባሪውን ክፈት", "Open attachment")}>{p.attachment_id}</a>
                          <button type="button" className="icon-btn" title={bi("ቅዳ", "Copy")} aria-label={bi("ቅዳ", "Copy")} onClick={() => copy(p.attachment_id)}>
                            <Icon name="copy" size={15} />
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn-attach" title={bi("አባሪ ፍጠር", "Generate attachment")} onClick={() => go(`/attachment/from/${p.id}`)}>
                          {bi("አባሪ", "Attach.")}
                        </button>
                      )}
                    </td>
                    <td className="num strong">{fmt(p.totals.grand)} <span className="muted">ETB</span></td>
                    <td className="act">
                      <a className="icon-btn" href={`#${c.base}/${p.id}`} aria-label={t("ክፈት")}><Icon name="open" size={17} /></a>
                      <GuardedEdit onGranted={(tok) => { setGrant(`proforma:${p.id}`, tok); go(`${c.base}/${p.id}/edit`); }} />
                      <GuardedDelete onConfirm={(tok) => remove(p.id, tok)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* second table: its own search + filter, independent from the one above */}
      <AttachmentTable onChanged={reload} />
    </>
  );
}