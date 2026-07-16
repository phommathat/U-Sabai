"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { KPI, Badge, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmtM, fdate, fmt, fmtMoney, toLAK } from "@/lib/fmt";

const CUR_ORDER = ["LAK", "THB", "USD"];

function Dashboard() {
  const { projectIds, projects } = useApp();
  const [counts, setCounts] = useState([]);   // v_project_summary (ນັບຕອນ)
  const [money, setMoney] = useState([]);      // v_project_money_cur (ເງິນ ແຍກສະກຸນ)
  const [costs, setCosts] = useState([]);      // v_project_cost_cur
  const [monthly, setMonthly] = useState([]);  // ຄາດຄະເນລາຍຮັບປະຈຳເດືອນ (ທຸກໂຄງການ)
  const [fx, setFx] = useState({ LAK: 1, THB: 620, USD: 21500 });
  const [overdueInst, setOverdueInst] = useState([]);
  const [overdueBk, setOverdueBk] = useState([]);
  // ໂໝດສະກຸນເງິນ: "split" = ແຍກສະກຸນ · "LAK"/"THB"/"USD" = ລວມເປັນສະກຸນນັ້ນ (ຄ່າເລີ່ມຕົ້ນ: ບາດ)
  const [curMode, setCurMode] = useState("THB");

  useEffect(() => {
    supabase.from("v_project_summary").select("*").then(({ data }) => setCounts(data || []));
    supabase.from("v_project_money_cur").select("*").then(({ data }) => setMoney(data || []));
    supabase.from("v_project_cost_cur").select("*").then(({ data }) => setCosts(data || []));
    supabase.from("v_monthly_due_cut6").select("*").then(({ data }) => setMonthly(data || []));
    supabase.from("fx_rates").select("*").then(({ data }) =>
      setFx(Object.fromEntries((data || []).map((r) => [r.currency, Number(r.rate_to_lak)]))));
    supabase.from("v_overdue_installments").select("*").limit(15).then(({ data }) => setOverdueInst(data || []));
    supabase.from("v_overdue_bookings").select("*").limit(15).then(({ data }) => setOverdueBk(data || []));
  }, []);

  // ---- filter ຕາມໂຄງການທີ່ຕິກເລືອກ ----
  const sel = new Set(projectIds);
  const cFilt = counts.filter((r) => sel.has(r.id));
  const mFilt = money.filter((r) => sel.has(r.project_id));
  const kFilt = costs.filter((r) => sel.has(r.project_id));

  // ---- ຄາດຄະເນລາຍຮັບປະຈຳເດືອນ: ຮອບ 6 ເດືອນນີ້ → 6 ເດືອນໜ້າ (ລວມທຸກໂຄງການ) ----
  const todayStr = new Date().toISOString().slice(0, 10);
  const curRows = monthly.filter((m) => m.period_from <= todayStr && todayStr <= m.period_to);
  const expByCur = {};
  curRows.forEach((m) => {
    expByCur[m.currency] = expByCur[m.currency] || { amt: 0, n: 0 };
    expByCur[m.currency].amt += Number(m.amount_expected || 0);
    expByCur[m.currency].n += Number(m.n_installments || 0);
  });
  const expCurs = CUR_ORDER.filter((c) => expByCur[c]);
  const period = curRows[0];

  // ---- ນັບຕອນ (ບໍ່ຂຶ້ນກັບສະກຸນ) ----
  const nLots = cFilt.reduce((s, p) => s + Number(p.total_lots || 0), 0);
  const nSold = cFilt.reduce((s, p) => s + Number(p.sold_lots || 0), 0);

  // ---- ລວມເງິນຕໍ່ສະກຸນ ----
  const byCur = {};
  const bump = (cur, k, v) => {
    byCur[cur] = byCur[cur] || { sales: 0, received: 0, balance: 0, cost: 0 };
    byCur[cur][k] += Number(v || 0);
  };
  mFilt.forEach((r) => { bump(r.currency, "sales", r.total_sales); bump(r.currency, "received", r.total_received); bump(r.currency, "balance", r.total_balance); });
  kFilt.forEach((r) => bump(r.currency, "cost", r.total_cost));
  const curs = CUR_ORDER.filter((c) => byCur[c]);

  // ---- ແປງທຸກສະກຸນ → ສະກຸນເປົ້າໝາຍ (ຜ່ານກີບ ຕາມ fx_rates) ----
  const split = curMode === "split";
  const conv = (amt, from) => Math.round(toLAK(amt, from, fx) / (fx[split ? "LAK" : curMode] || 1));
  const tot = { sales: 0, received: 0, balance: 0, cost: 0 };
  curs.forEach((c) => ["sales", "received", "balance", "cost"].forEach((k) => { tot[k] += conv(byCur[c][k], c); }));

  // ---- money ຕໍ່ໂຄງການ (ສຳລັບ card) ----
  const moneyByProj = {};
  mFilt.forEach((r) => {
    (moneyByProj[r.project_id] = moneyByProj[r.project_id] || { code: r.code, name: r.name, cur: {} });
    moneyByProj[r.project_id].cur[r.currency] = { sales: Number(r.total_sales), received: Number(r.total_received), balance: Number(r.total_balance) };
  });

  const MoneyStat = ({ label, k }) => (
    <div className="card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {!split ? (
        <div className="text-lg font-bold text-navy">{fmtMoney(tot[k], curMode)}</div>
      ) : curs.length ? (
        curs.map((c) => (
          <div key={c} className="text-base font-bold text-navy leading-tight">{fmtMoney(byCur[c][k], c)}</div>
        ))
      ) : <div className="text-slate-400">—</div>}
    </div>
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-navy">{projectIds.length === projects.length ? "ພາບລວມທຸກໂຄງການ" : `ພາບລວມ ${projectIds.length} ໂຄງການ`}</h2>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 mr-1">ສະກຸນເງິນ:</span>
          {[["THB", "฿ ບາດ"], ["LAK", "₭ ກີບ"], ["USD", "$ ໂດລາ"], ["split", "ແຍກສະກຸນ"]].map(([k, l]) => (
            <button key={k} onClick={() => setCurMode(k)}
              className={`px-3 py-1.5 rounded-full border ${curMode === k ? "bg-navy text-white border-navy" : "bg-white border-slate-300"}`}>{l}</button>
          ))}
          {!split && <span className="text-slate-400 ml-1">(THB={fx.THB?.toLocaleString()} ₭ · USD={fx.USD?.toLocaleString()} ₭)</span>}
        </div>
      </div>

      {/* ນັບຕອນ */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <KPI label="ໂຄງການ" value={cFilt.length} />
        <KPI label="ຕອນດິນລວມ" value={nLots} note={`ຂາຍແລ້ວ ${nSold}`} />
        <KPI label="ຄວາມຄືບໜ້າຂາຍ" value={nLots ? Math.round((nSold / nLots) * 100) + "%" : "—"} />
        <KPI label="ສະກຸນທີ່ໃຊ້" value={curs.join(" · ") || "—"} />
      </div>

      {/* ເງິນ ແຍກສະກຸນ (ຫຼື ລວມກີບ) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        <MoneyStat label="ຍອດຂາຍສະສົມ" k="sales" />
        <MoneyStat label="ເງິນຮັບຕົວຈິງ" k="received" />
        <MoneyStat label="ຍັງຄ້າງຮັບ" k="balance" />
        <MoneyStat label="ຕົ້ນທຶນສະສົມ" k="cost" />
      </div>
      {split && curs.length > 1 && (
        <p className="text-xs text-slate-400 -mt-4 mb-6">
          * ສະແດງແຍກຕາມສະກຸນ (ບໍ່ບວກປົນ). ເລືອກ ฿/₭/$ ເພື່ອເບິ່ງເລກລວມໂດຍປະມານ ຕາມອັດຕາປັດຈຸບັນ.
        </p>
      )}
      {!split && (
        <p className="text-xs text-slate-400 -mt-4 mb-6">
          * ເລກລວມແປງເປັນ {curMode} ໂດຍປະມານ ຕາມອັດຕາໃນໜ້າຕັ້ງຄ່າ — ບໍ່ແມ່ນຕົວເລກບັນຊີແທ້.
        </p>
      )}

      {/* ຄາດຄະເນລາຍຮັບປະຈຳເດືອນ — ລວມທຸກໂຄງການ, ຮອບ 6 ເດືອນນີ້ → 6 ເດືອນໜ້າ */}
      <div className="card mb-6 border-2 border-brand-amber/40 bg-amber-50/40">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <div className="font-bold text-navy">📅 ຄາດຄະເນລາຍຮັບປະຈຳເດືອນ <span className="font-normal text-xs text-slate-500">(ລວມທຸກໂຄງການ)</span></div>
            {period && <div className="text-xs text-slate-500 mt-0.5">ຮອບ {fdate(period.period_from)} → {fdate(period.period_to)}</div>}
          </div>
          {!expCurs.length ? <div className="text-slate-400 text-sm">ບໍ່ມີງວດຄາດຮັບໃນຮອບນີ້</div>
          : split ? expCurs.map((c) => (
            <div key={c} className="text-right">
              <div className="text-lg font-bold text-navy leading-tight">{fmtMoney(expByCur[c].amt, c)}</div>
              <div className="text-[10px] text-slate-400">{expByCur[c].n} ງວດ · {c}</div>
            </div>
          )) : (
            <div className="text-right">
              <div className="text-xl font-bold text-brand-green leading-tight">
                ≈ {fmtMoney(expCurs.reduce((s, c) => s + conv(expByCur[c].amt, c), 0), curMode)}
              </div>
              <div className="text-[10px] text-slate-400">{expCurs.reduce((s, c) => s + expByCur[c].n, 0)} ງວດ · ລວມເປັນ {curMode} ໂດຍປະມານ</div>
            </div>
          )}
        </div>
      </div>

      {/* card ຕໍ່ໂຄງການ — ໂຄງການປິດການຂາຍ/ປິດໂຄງການ ພັບເກັບໄວ້ລຸ່ມ */}
      {(() => {
        const statusOf = (id) => projects.find((x) => x.id === id)?.status;
        const isClosed = (p) => ["sold_out", "closed"].includes(statusOf(p.id));
        const ProjCard = (p) => {
          const m = moneyByProj[p.id];
          const mc = m ? CUR_ORDER.filter((c) => m.cur[c]) : [];
          return (
            <div key={p.id} className="card">
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-navy">🏘️ {p.code} — {p.name}</div>
                <Badge color={p.sold_lots > 0 ? "green" : "gray"}>{p.sold_lots}/{p.total_lots} ຂາຍແລ້ວ</Badge>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-brand-green rounded-full"
                  style={{ width: `${p.total_lots ? (p.sold_lots / p.total_lots) * 100 : 0}%` }} />
              </div>
              {mc.length ? mc.map((c) => (
                <div key={c} className="grid grid-cols-2 gap-1 text-xs text-slate-500 mb-1 pb-1 border-b border-slate-50 last:border-0">
                  <span className="col-span-2 text-[11px] font-semibold text-slate-400">{c}</span>
                  <span>ຂາຍ: <b className="text-navy">{fmtMoney(m.cur[c].sales, c)}</b></span>
                  <span>ຮັບ: <b className="text-navy">{fmtMoney(m.cur[c].received, c)}</b></span>
                  <span>ຄ້າງ: <b className="text-navy">{fmtMoney(m.cur[c].balance, c)}</b></span>
                </div>
              )) : <div className="text-xs text-slate-400">ຍັງບໍ່ມີສັນຍາ</div>}
            </div>
          );
        };
        const act = cFilt.filter((p) => !isClosed(p));
        const cls = cFilt.filter(isClosed);
        return (<>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">{act.map(ProjCard)}</div>
          {cls.length > 0 && (
            <details className="mb-6">
              <summary className="cursor-pointer text-sm text-slate-500 font-semibold mb-3">
                📦 ໂຄງການປິດການຂາຍ/ປິດແລ້ວ ({cls.length}) — ກົດເພື່ອເປີດເບິ່ງ
              </summary>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 opacity-75">{cls.map(ProjCard)}</div>
            </details>
          )}
        </>);
      })()}

      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="font-bold text-navy mb-2">⚠️ ງວດຄ້າງຊຳລະ</h3>
          <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ຄົບກຳນົດ", "ຍອດຄ້າງ"]}
            empty="ບໍ່ມີງວດຄ້າງຊຳລະ 🎉"
            rows={overdueInst.map((o) => [
              o.contract_no, o.full_name,
              <span key="d" className="text-brand-red">{fdate(o.due_date)}</span>,
              fmt(o.amount_outstanding),
            ])} />
        </div>
        <div>
          <h3 className="font-bold text-navy mb-2">📌 ໃບຈອງກາຍກຳນົດເຮັດສັນຍາ</h3>
          <Table cols={["ໃບຈອງ", "ລູກຄ້າ", "ຕອນ", "ກຳນົດ", "ກາຍ (ວັນ)"]}
            empty="ບໍ່ມີໃບຈອງກາຍກຳນົດ"
            rows={overdueBk.map((b) => [
              b.booking_no, b.full_name, b.lot_code,
              <span key="d" className="text-brand-red">{fdate(b.contract_due_date)}</span>,
              b.days_overdue,
            ])} />
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Dashboard /></Shell>;
}
