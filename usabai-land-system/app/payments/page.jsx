"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate } from "@/lib/fmt";

function Payments() {
  const { projectId } = useApp();
  const [inst, setInst] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [hist, setHist] = useState([]);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("due");

  const load = async () => {
    if (!projectId) return;
    const { data: cons } = await supabase.from("contracts")
      .select("id,contract_no,currency, customers(full_name)").eq("project_id", projectId);
    setContracts(cons || []);
    const ids = (cons || []).map((c) => c.id);
    if (!ids.length) { setInst([]); setHist([]); return; }
    const { data: ins } = await supabase.from("installments")
      .select("*, payments(id, amount_received)").in("contract_id", ids)
      .order("due_date", { ascending: true, nullsFirst: false }).limit(500);
    setInst(ins || []);
    const { data: pays } = await supabase.from("payments")
      .select("id,pay_date,amount_received,currency,channel,note,contracts!inner(contract_no,project_id,customers(full_name))")
      .eq("contracts.project_id", projectId).neq("pay_date", "1900-01-01")
      .order("pay_date", { ascending: false }).limit(1000);
    setHist(pays || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const today = new Date().toISOString().slice(0, 10);
  const cmap = Object.fromEntries(contracts.map((c) => [c.id, c]));
  const enrich = inst.map((i) => {
    const paid = (i.payments || []).reduce((s, p) => s + Number(p.amount_received || 0), 0);
    const st = paid >= Number(i.amount_due) ? "paid"
      : i.due_date && i.due_date < today ? "overdue"
      : i.due_condition === "after_deed_transfer" ? "deed" : "due";
    return { ...i, paid, st, c: cmap[i.contract_id] };
  });
  const filtered = enrich.filter((i) =>
    tab === "all" ? true : tab === "due" ? i.st !== "paid" : i.st === tab);

  const receive = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("payments").insert({
      contract_id: form.contract_id, installment_id: form.installment_id,
      pay_date: form.pay_date, amount_received: form.amount_received,
      currency: form.currency, channel: form.channel, receipt_no: form.receipt_no || null, note: form.note || null,
    });
    if (error) return alert("ຜິດພາດ: " + error.message);
    setForm(null); load();
  };

  const ST = {
    paid: <Badge color="green">ຈ່າຍແລ້ວ</Badge>, overdue: <Badge color="red">ຄ້າງຊຳລະ</Badge>,
    due: <Badge color="gray">ຍັງບໍ່ຮອດກຳນົດ</Badge>, deed: <Badge color="navy">ຈ່າຍຫຼັງໂອນໃບຕາດິນ</Badge>,
  };

  return (
    <>
      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-navy mr-auto">ການຊຳລະເງິນ</h2>
        {[["due", "ຄ້າງ/ໃກ້ຄົບ"], ["overdue", "ຄ້າງຊຳລະ"], ["paid", "ຈ່າຍແລ້ວ"], ["all", "ທັງໝົດ"], ["history", "ປະຫວັດຮັບເງິນ"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${tab === k ? "bg-navy text-white border-navy" : "bg-white border-slate-300"}`}>{l}</button>
        ))}
      </div>

      {tab === "history" ? (
        <Table cols={["ວັນທີຮັບ", "ສັນຍາ", "ລູກຄ້າ", "ຈຳນວນຮັບ", "ຊ່ອງທາງ", "ໝາຍເຫດ"]}
          empty="ຍັງບໍ່ມີປະຫວັດການຮັບເງິນ"
          rows={hist.slice(0, 500).map((p) => [
            fdate(p.pay_date), p.contracts?.contract_no, p.contracts?.customers?.full_name,
            <b key="a">{fmt(p.amount_received, p.currency)}</b>, p.channel || "—", p.note || "—",
          ])} />
      ) : (
      <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ງວດ", "ຄົບກຳນົດ", "ຕາມກຳນົດ", "ຮັບແລ້ວ", "ສະຖານະ", ""]}
        rows={filtered.slice(0, 120).map((i) => [
          i.c?.contract_no, i.c?.customers?.full_name,
          i.seq === 0 ? "ດາວ/ຈອງ" : `ງວດ ${i.seq}`,
          <span key="d" className={i.st === "overdue" ? "text-brand-red" : ""}>{fdate(i.due_date)}</span>,
          fmt(i.amount_due, i.c?.currency), fmt(i.paid || null, i.c?.currency), ST[i.st],
          i.st !== "paid" ? (
            <button key="r" className="btn-p !py-1 !px-3 text-xs"
              onClick={() => setForm({
                contract_id: i.contract_id, installment_id: i.id, pay_date: today,
                amount_due: i.amount_due, amount_received: Number(i.amount_due) - i.paid,
                currency: i.c?.currency || "LAK", channel: "ເງິນສົດ",
                receipt_no: `R-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
                label: `${i.c?.contract_no} · ${i.seq === 0 ? "ດາວ/ຈອງ" : "ງວດ " + i.seq}`,
              })}>ຮັບເງິນ</button>
          ) : i.payments?.[0]?.id ? (
            <a key="r" className="btn-o !py-1 !px-3 text-xs" href={`/print/receipt/${i.payments[i.payments.length - 1].id}`} target="_blank">🖨 ໃບຮັບເງິນ</a>
          ) : null,
        ])} />
      )}

      <Modal open={!!form} title="💰 ບັນທຶກຮັບເງິນ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={receive} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 text-sm text-slate-500">{form.label}</div>
            <Field label="ຈຳນວນຕາມກຳນົດ"><input className="inp bg-slate-50" disabled value={Number(form.amount_due).toLocaleString()} /></Field>
            <Field label="ຈຳນວນຮັບຕົວຈິງ (ຄີແກ້ໄຂໄດ້) *">
              <input className="inp font-bold text-navy" type="number" required value={form.amount_received}
                onChange={(e) => setForm({ ...form, amount_received: e.target.value })} />
            </Field>
            <Field label="ວັນທີຮັບເງິນ *"><input className="inp" type="date" required value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ຊ່ອງທາງ">
              <select className="inp" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option>ເງິນສົດ</option><option>ໂອນ BCEL</option><option>ໂອນ LDB</option><option>ໂອນທະນາຄານອື່ນ</option>
              </select>
            </Field>
            <Field label="ເລກໃບຮັບເງິນ"><input className="inp" placeholder="R-2026-0001" value={form.receipt_no || ""} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })} /></Field>
            <div className="col-span-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800">
              ຮັບໜ້ອຍກວ່າກຳນົດ = ຍອດຄ້າງຍັງຄົງຄ້າງໃນງວດນີ້ · ໃບຮັບເງິນ PDF ຈະມາໃນໄລຍະ 2
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກຮັບເງິນ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Payments /></Shell>; }
