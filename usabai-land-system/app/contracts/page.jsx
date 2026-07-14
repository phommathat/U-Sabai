"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, PAY_TYPE, CONTRACT_STATUS, buildInstallments } from "@/lib/fmt";

const ST_COLOR = { booking: "amber", paying: "blue", overdue: "red", completed: "green", cancelled: "gray" };

function Contracts() {
  const { projectId } = useApp();
  const [rows, setRows] = useState([]);
  const [bal, setBal] = useState({});
  const [lots, setLots] = useState([]);
  const [custs, setCusts] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => {
    if (!projectId) return;
    supabase.from("contracts")
      .select("*, lots(code), customers(code,full_name)")
      .eq("project_id", projectId).order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setRows(data || []));
    supabase.from("v_contract_balance").select("*").eq("project_id", projectId)
      .then(({ data }) => setBal(Object.fromEntries((data || []).map((b) => [b.id, b]))));
    supabase.from("lots").select("id,code,list_price,currency").eq("project_id", projectId)
      .in("status", ["available", "reserved"]).order("code").then(({ data }) => setLots(data || []));
    supabase.from("customers").select("id,code,full_name").order("code").limit(500)
      .then(({ data }) => setCusts(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const pickLot = (id) => {
    const l = lots.find((x) => x.id === id);
    setForm({ ...form, lot_id: id, list_price: l?.list_price, sale_price: l?.list_price, currency: l?.currency || "LAK" });
  };

  const save = async (e) => {
    e.preventDefault();
    const c = { ...form, project_id: projectId, discount: form.discount || 0 };
    const { data, error } = await supabase.from("contracts").insert(c).select().single();
    if (error) return alert("ຜິດພາດ: " + error.message);
    const inst = buildInstallments(c).map((r) => ({ ...r, contract_id: data.id }));
    if (inst.length) await supabase.from("installments").insert(inst);
    await supabase.from("lots").update({ status: "sold" }).eq("id", c.lot_id);
    setForm(null); load();
    alert(`ບັນທຶກສັນຍາ ${c.contract_no} ສຳເລັດ — ສ້າງ ${inst.length} ງວດອັດຕະໂນມັດ`);
  };

  const isInst = form?.pay_type === "installment";
  const isCash = form?.pay_type === "cash";

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-navy">ສັນຍາຂາຍ ({rows.length})</h2>
        <button className="btn-p" onClick={() => setForm({ pay_type: "installment", currency: "LAK", sign_date: new Date().toISOString().slice(0, 10), installment_period_months: 1, status: "paying", balance_due_when: "after_deed_transfer" })}>
          + ສ້າງສັນຍາໃໝ່
        </button>
      </div>
      <Table cols={["ເລກສັນຍາ", "ລູກຄ້າ", "ຕອນ", "ປະເພດ", "ມູນຄ່າ", "ຊຳລະແລ້ວ", "%", "ສະຖານະ", ""]}
        rows={rows.map((c) => {
          const b = bal[c.id] || {};
          return [
            <b key="n">{c.contract_no}</b>, c.customers?.full_name, c.lots?.code,
            <Badge key="t" color="navy">{PAY_TYPE[c.pay_type]}</Badge>,
            fmt(c.sale_price, c.currency), fmt(b.total_paid, c.currency),
            <div key="p" className="w-24">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-green" style={{ width: `${Math.min(b.pct_paid || 0, 100)}%` }} />
              </div>
              <div className="text-[10px] text-slate-400">{b.pct_paid || 0}%{b.deed_eligible && " · ✓ ເກນ 20%"}</div>
            </div>,
            <Badge key="s" color={ST_COLOR[c.status]}>{CONTRACT_STATUS[c.status]}</Badge>,
            <a key="pr" className="btn-o !py-1 !px-2 text-xs" href={`/print/contract/${c.id}`} target="_blank">🖨</a>,
          ];
        })} />

      <Modal open={!!form} title="ສ້າງສັນຍາໃໝ່" onClose={() => setForm(null)} wide>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ເລກສັນຍາ *"><input className="inp" required placeholder="S1-2026-001" value={form.contract_no || ""} onChange={(e) => setForm({ ...form, contract_no: e.target.value })} /></Field>
            <Field label="ວັນທີເຊັນ *"><input className="inp" type="date" required value={form.sign_date} onChange={(e) => setForm({ ...form, sign_date: e.target.value })} /></Field>
            <Field label="ຕອນດິນ *">
              <select className="inp" required value={form.lot_id || ""} onChange={(e) => pickLot(e.target.value)}>
                <option value="">— ເລືອກ —</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.code} — {fmt(l.list_price, l.currency)}</option>)}
              </select>
            </Field>
            <Field label="ລູກຄ້າ *">
              <select className="inp" required value={form.customer_id || ""} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— ເລືອກ —</option>
                {custs.map((c) => <option key={c.id} value={c.id}>{c.code} {c.full_name}</option>)}
              </select>
            </Field>
            <Field label="ລາຄາຕັ້ງ"><input className="inp" type="number" value={form.list_price || ""} onChange={(e) => setForm({ ...form, list_price: e.target.value })} /></Field>
            <Field label="ສ່ວນຫຼຸດ"><input className="inp" type="number" value={form.discount || ""} onChange={(e) => setForm({ ...form, discount: e.target.value, sale_price: (form.list_price || 0) - (e.target.value || 0) })} /></Field>
            <Field label="ລາຄາຂາຍຕົວຈິງ (ຄີໄດ້) *"><input className="inp font-bold" type="number" required value={form.sale_price || ""} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ປະເພດການຊຳລະ *">
              <select className="inp" value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
                <option value="installment">ຜ່ອນເປັນງວດ</option>
                <option value="cash">ຈ່າຍສົດ (ກຳນົດງວດເອງ)</option>
                <option value="bank">ຜ່ານທະນາຄານ</option>
              </select>
            </Field>
            {isInst && (<>
              <Field label="ເງິນດາວ"><input className="inp" type="number" value={form.down_payment || ""} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} /></Field>
              <Field label="ຈຳນວນງວດ *"><input className="inp" type="number" required value={form.n_installments || ""} onChange={(e) => setForm({ ...form, n_installments: e.target.value })} /></Field>
              <Field label="ຄາບການຈ່າຍ">
                <select className="inp" value={form.installment_period_months} onChange={(e) => setForm({ ...form, installment_period_months: e.target.value })}>
                  <option value="1">ທຸກ 1 ເດືອນ</option><option value="3">ທຸກ 3 ເດືອນ</option><option value="6">ທຸກ 6 ເດືອນ</option>
                </select>
              </Field>
              <Field label="ເງິນຕໍ່ງວດ *"><input className="inp" type="number" required value={form.installment_amt || ""} onChange={(e) => setForm({ ...form, installment_amt: e.target.value })} /></Field>
              <Field label="ວັນຄົບກຳນົດງວດທຳອິດ *"><input className="inp" type="date" required value={form.first_due_date || ""} onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} /></Field>
            </>)}
            {isCash && (<>
              <Field label="ຈ່າຍສົດ ງວດ 1 *"><input className="inp" type="number" required value={form.cash_pay1 || ""} onChange={(e) => setForm({ ...form, cash_pay1: e.target.value })} /></Field>
              <Field label="ຈ່າຍສົດ ງວດ 2 (ຖ້າມີ)"><input className="inp" type="number" value={form.cash_pay2 || ""} onChange={(e) => setForm({ ...form, cash_pay2: e.target.value })} /></Field>
              <Field label="ສ່ວນທີ່ເຫຼືອຈ່າຍເມື່ອ">
                <select className="inp" value={form.balance_due_when} onChange={(e) => setForm({ ...form, balance_due_when: e.target.value })}>
                  <option value="after_deed_transfer">ຫຼັງໂອນຊື່ໃບຕາດິນສຳເລັດ</option>
                  <option value="fixed_date">ຕາມວັນທີກຳນົດ</option>
                  <option value="single_payment">ຈ່າຍຄົບຄັ້ງດຽວ</option>
                </select>
              </Field>
            </>)}
            <Field label="ພະນັກງານຂາຍ"><input className="inp" value={form.sales_person || ""} onChange={(e) => setForm({ ...form, sales_person: e.target.value })} /></Field>
            <div className="col-span-2 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
              ບັນທຶກແລ້ວ: ຕອນດິນຖືກລັອກເປັນ "ຂາຍແລ້ວ" + ລະບົບສ້າງຕາຕະລາງງວດອັດຕະໂນມັດ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກສັນຍາ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Contracts /></Shell>; }
