"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, BOOKING_STATUS } from "@/lib/fmt";

const ST_COLOR = { active: "amber", converted: "green", expired: "red", cancelled: "gray", refunded: "gray" };

function Bookings() {
  const { projectId } = useApp();
  const [rows, setRows] = useState([]);
  const [lots, setLots] = useState([]);
  const [custs, setCusts] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => {
    if (!projectId) return;
    supabase.from("bookings")
      .select("*, lots(code), customers(code,full_name)")
      .eq("project_id", projectId).order("booking_date", { ascending: false })
      .then(({ data }) => setRows(data || []));
    supabase.from("lots").select("id,code").eq("project_id", projectId).eq("status", "available").order("code")
      .then(({ data }) => setLots(data || []));
    supabase.from("customers").select("id,code,full_name").order("code").limit(500)
      .then(({ data }) => setCusts(data || []));
  };
  useEffect(() => { load(); }, [projectId]);

  const save = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("bookings").insert({ ...form, project_id: projectId });
    if (error) return alert("ຜິດພາດ: " + error.message);
    await supabase.from("lots").update({ status: "reserved" }).eq("id", form.lot_id);
    setForm(null); load();
  };

  const setStatus = async (b, status) => {
    await supabase.from("bookings").update({ status }).eq("id", b.id);
    if (["cancelled", "refunded", "expired"].includes(status))
      await supabase.from("lots").update({ status: "available" }).eq("id", b.lot_id);
    load();
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-navy">ການຈອງ / ໃບຈອງດິນ</h2>
        <button className="btn-p" onClick={() => setForm({ booking_date: today, status: "active" })}>+ ອອກໃບຈອງດິນ</button>
      </div>
      <Table cols={["ເລກໃບຈອງ", "ລູກຄ້າ", "ຕອນ", "ວັນທີຈອງ", "ເງິນມັດຈຳ", "ກຳນົດເຮັດສັນຍາ", "ສະຖານະ", ""]}
        rows={rows.map((b) => {
          const over = b.status === "active" && b.contract_due_date < today;
          return [
            <b key="n">{b.booking_no}</b>, b.customers?.full_name, b.lots?.code,
            fdate(b.booking_date), fmt(b.deposit_amount),
            <span key="d" className={over ? "text-brand-red font-semibold" : ""}>{fdate(b.contract_due_date)}{over && " ⚠"}</span>,
            <Badge key="s" color={over ? "red" : ST_COLOR[b.status]}>{over ? "ກາຍກຳນົດ" : BOOKING_STATUS[b.status]}</Badge>,
            <span key="a" className="flex gap-1">
              <a className="btn-o !py-1 !px-2 text-xs" href={`/print/booking/${b.id}`} target="_blank">🖨 ໃບຈອງ</a>
              {b.status === "active" && (<>
                <button className="btn-p !py-1 !px-2 text-xs" onClick={() => setStatus(b, "converted")}>ເຮັດສັນຍາແລ້ວ</button>
                <button className="btn-o !py-1 !px-2 text-xs" onClick={() => setStatus(b, "cancelled")}>ຍົກເລີກ</button>
              </>)}
            </span>,
          ];
        })} />

      <Modal open={!!form} title="ອອກໃບຈອງດິນ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ເລກໃບຈອງ *"><input className="inp" required placeholder="B1-2026-001" value={form.booking_no || ""} onChange={(e) => setForm({ ...form, booking_no: e.target.value })} /></Field>
            <Field label="ວັນທີຈອງ *"><input className="inp" type="date" required value={form.booking_date || ""} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></Field>
            <Field label="ຕອນດິນ (ສະເພາະທີ່ຫວ່າງ) *">
              <select className="inp" required value={form.lot_id || ""} onChange={(e) => setForm({ ...form, lot_id: e.target.value })}>
                <option value="">— ເລືອກ —</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
              </select>
            </Field>
            <Field label="ລູກຄ້າ *">
              <select className="inp" required value={form.customer_id || ""} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">— ເລືອກ —</option>
                {custs.map((c) => <option key={c.id} value={c.id}>{c.code} {c.full_name}</option>)}
              </select>
            </Field>
            <Field label="ເງິນມັດຈຳ (₭) *"><input className="inp" type="number" required value={form.deposit_amount || ""} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></Field>
            <Field label="ກຳນົດມື້ເຮັດສັນຍາ *"><input className="inp" type="date" required value={form.contract_due_date || ""} onChange={(e) => setForm({ ...form, contract_due_date: e.target.value })} /></Field>
            <div className="col-span-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
              ບັນທຶກແລ້ວ ຕອນດິນຈະປ່ຽນເປັນ "ຈອງ" ອັດຕະໂນມັດ — ຖ້າກາຍກຳນົດ ລະບົບຈະເຕືອນໃນໜ້າພາບລວມ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ + ອອກໃບຈອງ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Bookings /></Shell>; }
