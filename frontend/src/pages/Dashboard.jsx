import { api } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { MONTHS, WEEKDAYS, dstr, todayEth } from "../lib/ethiopian.js";
import { fmt, fmt0 } from "../lib/format.js";
import { useResource, useSettings } from "../lib/hooks.jsx";
import { useSubmit } from "../lib/forms.js";
import { BarChart, Legend, LineChart } from "../components/Charts.jsx";
import { Button, Card, Empty, ErrorNote, Loading, PageHeader, Pill, StatusPill } from "../components/ui.jsx";
import Icon from "../components/Icon.jsx";
import { Donut, Kpi, Panel, Rank, compact } from "../components/Viz.jsx";

const BLUES = ["#38bdf8", "#2563eb", "#22d3ee", "#818cf8", "#14b8a6", "#a78bfa"];
const STATUS = ["#38bdf8", "#fbbf24", "#f87171"];
const AlertIc = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);

export default function Dashboard() {
  const { settings } = useSettings();
  const { data, loading, error, reload } = useResource("/dashboard/");
  const [busy, run] = useSubmit();
  const now = todayEth();
  const head = (
    <PageHeader title={settings?.name || t("ዳሽቦርድ")} subtitle={`${WEEKDAYS[new Date().getDay()]}, ${dstr(now)}`}>
      <Button variant="ghost" icon="sales" onClick={() => { window.location.hash = "/sales"; }}>{t("ሽያጭ መዝግብ")}</Button>
    </PageHeader>
  );
  if (loading && !data) return <>{head}<Loading /></>;
  if (error && !data) return <>{head}<ErrorNote error={error} retry={reload} /></>;

  const k = data.kpis;
  const p = data.period;
  const labels = data.months.map((m) => MONTHS[m.m - 1].slice(0, 3));
  const names = data.months.map((m) => MONTHS[m.m - 1]);
  const daySpark = data.daily.filter((x) => x.d <= p.d).slice(-10).map((x) => Number(x.sales));
  const monthSpark = data.months.map((m) => Number(m.sales));
  const splitTotal = Number(data.split.cash) + Number(data.split.credit);
  const st = data.stock_status;
  const stTotal = st.ok + st.low + st.out;
  const shareTotal = data.share.reduce((a, s) => a + Number(s.value), 0);
  const none = t("ገና መረጃ የለም።");

  return (
    <>
      {head}
      <div className="dash">
        {data.is_empty && (
          <Card>
            <Empty action={
              <div className="page-actions">
                <Button icon="plus" onClick={() => { window.location.hash = "/stock"; }}>{t("ዕቃ ጨምር")}</Button>
                <Button variant="ghost" disabled={busy} onClick={async () => { if (await run(() => api.post("/demo/load/"), t("የናሙና መረጃ ተጭኗል"))) reload(); }}>{t("የናሙና መረጃ ጫን")}</Button>
              </div>}>
              {t("ደብተሩ ባዶ ነው። ዕቃ በመጨመር ይጀምሩ ወይም ናሙና ይጫኑ።")}
            </Empty>
          </Card>
        )}

        <div className="dk-row">
          <Kpi tone="t2" icon={<Icon name="stock" size={17} />} label={t("የክምችት ዋጋ")} value={k.stock_value} unit={t("ብር")} />
          <Kpi tone="t1" icon={<Icon name="sales" size={17} />} label={t("የዛሬ ሽያጭ")} value={k.day_sales} unit={t("ብር")}
            change={k.day_change} note={t("ከትናንት ጋር")} spark={daySpark} />
          <Kpi tone="t3" icon={<Icon name="dashboard" size={17} />} label={t("የ{month} ሽያጭ", { month: MONTHS[p.m - 1] })} value={k.month_sales} unit={t("ብር")}
            change={k.month_change} note={t("ከባለፈው ወር ጋር")} spark={monthSpark} />
          <Kpi tone="t4" icon={<AlertIc />} label={t("ሊያልቁ የተቃረቡ")} value={k.low_count} unit={t("ዕቃ")}
            note={t("{n} አልቀዋል", { n: k.out_count })} />
          <Kpi tone="t5" icon={<Icon name="debts" size={17} />} label={t("ጠቅላላ ዕዳ")} value={k.debt_total} unit={t("ብር")}
            note={t("{n} ተበዳሪዎች", { n: k.debtors })} />
        </div>

        <div className="dgrid a">
          <Panel title={t("ወርሃዊ ሽያጭ · {y}", { y: p.y })} aside={<Legend series={[{ name: t("ሽያጭ"), color: BLUES[0] }, { name: t("የዕቃ ዋጋ"), color: BLUES[3] }]} />}>
            <LineChart labels={labels} names={names} series={[
              { name: t("ሽያጭ"), color: BLUES[0], values: data.months.map((m) => Number(m.sales)) },
              { name: t("የዕቃ ዋጋ"), color: BLUES[3], values: data.months.map((m) => Number(m.cost)) },
            ]} />
          </Panel>
          <Panel title={t("ሽያጭ በዕቃ")}>
            <Donut empty={none} colors={BLUES} center={compact(shareTotal)} sub={t("ጠቅላላ")}
              data={data.share.map((s) => ({ name: s.other ? t("ሌላ") : s.name, value: s.value }))} />
          </Panel>
          <Panel title={t("የሽያጭ አይነት")} aside={<small>{MONTHS[p.m - 1]}</small>}>
            <Donut empty={none} colors={[BLUES[0], BLUES[3]]} center={compact(splitTotal)} sub={t("ጠቅላላ")}
              data={[{ name: t("ጥሬ ገንዘብ"), value: data.split.cash }, { name: t("ዱቤ"), value: data.split.credit }]} />
          </Panel>
        </div>

        <div className="dgrid a">
          <Panel title={t("የዕለት ሽያጭ · {m}", { m: MONTHS[p.m - 1] })}>
            <BarChart labels={data.daily.map((x) => String(x.d))} names={data.daily.map((x) => `${MONTHS[p.m - 1]} ${x.d}`)} series={[
              { name: t("ሽያጭ"), color: BLUES[0], values: data.daily.map((x) => Number(x.sales)) },
            ]} />
          </Panel>
          <Panel title={t("የክምችት ሁኔታ")}>
            <Donut empty={none} colors={STATUS} center={stTotal} sub={t("ዕቃ")}
              data={[{ name: t("በቂ"), value: st.ok }, { name: t("ሊያልቅ ነው"), value: st.low }, { name: t("አልቋል"), value: st.out }]} />
          </Panel>
          <Panel title={t("ዋና ተበዳሪዎች")}>
            <Rank empty={none} items={data.top_debtors.map((r) => ({ label: r.name, value: r.balance, text: fmt(r.balance) }))} />
          </Panel>
        </div>

        <div className="dgrid c">
          <Panel title={t("ብዙ የተሸጡ")}>
            <Rank empty={none} items={data.top_qty.map((r) => ({ label: r.name, value: r.sold, text: `${fmt0(r.sold)} ${r.unit || ""}` }))} />
          </Panel>
          <Panel title={t("ብዙ ትርፍ ያመጡ")}>
            <Rank empty={none} items={data.top_profit.map((r) => ({ label: r.name, value: r.profit, text: fmt(r.profit) }))} />
          </Panel>
          <Panel title={t("ከፍተኛ ዋጋ ያላቸው ክምችቶች")}>
            <Rank empty={none} items={data.top_value.map((r) => ({ label: r.name, value: r.value, text: fmt(r.value) }))} />
          </Panel>
        </div>

        <div className="dgrid d">
          <Panel title={t("የቅርብ ግብይቶች")}>
            {data.recent.length === 0 ? <p className="muted">{none}</p> : (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>{t("ቀን")}</th><th>{t("ዕቃ")}</th><th className="num">{t("ጠቅላላ")}</th><th>{t("አይነት")}</th></tr></thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td className="muted">{dstr(r)}</td>
                        <td className="strong">{r.item}</td>
                        <td className="num">{fmt(r.total)}</td>
                        <td>{r.type === "credit" ? <Pill tone="warn">{t("ዱቤ")}</Pill> : <Pill tone="ok">{t("ጥሬ")}</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel title={t("ክምችት ማስጠንቀቂያ")}>
            {data.low_stock.length === 0 ? <p className="muted">{t("ሁሉም ዕቃ በቂ ነው።")}</p> : (
              <div className="bar-list">
                {data.low_stock.map((r) => (
                  <div className="top" key={r.name} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>{r.name} <span className="muted">· {fmt0(r.left)} {r.unit}</span></span>
                    <StatusPill status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}