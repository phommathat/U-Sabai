"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { KPI, Badge, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmtM, fdate, fmt } from "@/lib/fmt";

function Dashboard() {
  const { projects, projectId } = useApp();
  const [sum, setSum] = useState([]);
  const [overdueInst, setOverdueInst] = useState([]);
  const [overdueBk, setOverdueBk] = useState([]);

  useEffect(() => {
    supabase.from("v_project_summary").select("*").then(({ data }) => setSum(data || []));
    supabase.from("v_overdue_installments").select("*").limit(15).then(({ data }) => setOverdueInst(data || []));
    supabase.from("v_overdue_bookings").select("*").limit(15).then(({ data }) => setOverdueBk(data || []));
  }, [projectId]);

  const tot = (k) => sum.reduce((s, p) => s + Number(p[k] || 0), 0);

  return (
    <>
      <h2 className="text-lg font-bold text-navy mb-4">ພາບລວມທຸກໂຄງການ</h2>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-5">
        <KPI label="ໂຄງການ" value={sum.length} />
        <KPI label="ຕອນດິນລວມ" value={tot("total_lots")} note={`ຂາຍແລ້ວ ${tot("sold_lots")}`} />
        <KPI label="ຍອດຂາຍສະສົມ" value={fmtM(tot("total_sales"))} />
        <KPI label="ເງິນຮັບຕົວຈິງ" value={fmtM(tot("total_received"))} />
        <KPI label="ຕົ້ນທຶນສະສົມ" value={fmtM(tot("total_cost"))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-6">
        {sum.map((p) => (
          <div key={p.id} className="card">
            <div className="flex justify-between items-start mb-2">
              <div className="font-bold text-navy">🏘️ {p.code} — {p.name}</div>
              <Badge color={p.sold_lots > 0 ? "green" : "gray"}>{p.sold_lots}/{p.total_lots} ຂາຍແລ້ວ</Badge>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-brand-green rounded-full"
                style={{ width: `${p.total_lots ? (p.sold_lots / p.total_lots) * 100 : 0}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
              <span>ຍອດຂາຍ: <b className="text-navy">{fmtM(p.total_sales)}</b></span>
              <span>ເງິນຮັບ: <b className="text-navy">{fmtM(p.total_received)}</b></span>
              <span>ຄ້າງຮັບ: <b className="text-navy">{fmtM(p.total_sales - p.total_received)}</b></span>
              <span>ຕົ້ນທຶນ: <b className="text-navy">{fmtM(p.total_cost)}</b></span>
            </div>
          </div>
        ))}
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
