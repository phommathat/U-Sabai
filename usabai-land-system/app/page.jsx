"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { KPI, Badge, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmtM, fdate, fmt, fmtMoney, toLAK } from "@/lib/fmt";

const CUR_ORDER = ["LAK", "THB", "USD"];

function Dashboard() {
  const { projectId } = useApp();
  const [counts, setCounts] = useState([]);   // v_project_summary (ນັບຕອນ)
  const [money, setMoney] = useState([]);      // v_project_money_cur (ເງິນ ແຍກສະກຸນ)
  const [costs, setCosts] = useState([]);      // v_project_cost_cur
  const [fx, setFx] = useState({ LAK: 1, THB: 620, USD: 21500 });
  const [overdueInst, setOverdueInst] = useState([]);
  const [overdueBk, setOverdueBk] = useState([]);
  const [combine, setCombine] = useState(false); // ປຸ່ມລວມເປັນກີບ

  useEffect(() => {
    supabase.from("v_project_summary").select("*").then(({ data }) => setCounts(data || []));
    supabase.from("v_project_money_cur").select("*").then(({ data }) => setMoney(data || []));
    supabase.from("v_project_cost_cur").select("*").then(({ data }) => setCosts(data || []));
    supabase.from("fx_rates").select("*").then(({ data }) =>
      setFx(Object.fromEntries((data || []).map((r) => [r.currency, Number(r.rate_to_lak)]))));
    supabase.from("v_overdue_installments").select("*").limit(15).then(({ data }) => setOverdueInst(data || []));
    supabase.from("v_overdue_bookings").select("*").limit(15).then(({ data }) => setOverdueBk(data || []));
  }, []);

  // ---- filter ຕາມໂຄງການທີ່ເລືອກ (ຫວ່າງ = ທຸກໂຄງການ) ----
  const inScope = (r) => !projectId || r.project_id === projectId;
  const cFilt = counts.filter(inScope);
  const mFilt = money.filter(inScope);
  const kFilt = costs.filter(inScope);

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

  // ---- ລວມເປັນກີບ (ທາງເລືອກ) ----
  const lak = { sales: 0, received: 0, balance: 0, cost: 0 };
  curs.forEach((c) => ["sales", "received", "balance", "cost"].forEach((k) => { lak[k] += toLAK(byCur[c][k], c, fx); }));

  // ---- money ຕໍ່ໂຄງການ (ສຳລັບ card) ----
  const moneyByProj = {};
  mFilt.forEach((r) => {
    (moneyByProj[r.project_id] = moneyByProj[r.project_id] || { code: r.code, name: r.name, cur: {} });
    moneyByProj[r.project_id].cur[r.currency] = { sales: Number(r.total_sales), received: Number(r.total_received), balance: Number(r.total_balance) };
  });

  const MoneyStat = ({ label, k }) => (
    <div className="card">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {combine ? (
        <div className="text-lg font-bold text-navy">{fmtM(lak[k])} ₭</div>
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
        <h2 className="text-lg font-bold text-navy">{projectId ? "ພາບລວມໂຄງການ" : "ພາບລວມທຸກໂຄງການ"}</h2>
        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={combine} onChange={(e) => setCombine(e.target.checked)} />
          ລວມເປັນກີບ {combine && <span className="text-slate-400">(THB={fx.THB?.toLocaleString()} · USD={fx.USD?.toLocaleString()})</span>}
        </label>
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
      {!combine && curs.length > 1 && (
        <p className="text-xs text-slate-400 -mt-4 mb-6">
          * ສະແດງແຍກຕາມສະກຸນ (ບໍ່ບວກປົນ). ຕິກ "ລວມເປັນກີບ" ເພື່ອເບິ່ງເລກລວມໂດຍປະມານ ຕາມອັດຕາປັດຈຸບັນ.
        </p>
      )}

      {/* card ຕໍ່ໂຄງການ */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
        {cFilt.map((p) => {
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
        })}
      </div>

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
