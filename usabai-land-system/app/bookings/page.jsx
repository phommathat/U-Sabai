"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, BOOKING_STATUS } from "@/lib/fmt";

const ST_COLOR = { active: "amber", converted: "green", expired: "red", cancelled: "gray", refunded: "gray" };

function Bookings() {
  const { projectId, projectIds, profile } = useApp();
  const [rows, setRows] = useState([]);
  const [lots, setLots] = useState([]);
  const [custs, setCusts] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => {
    if (!projectIds.length) return;
    supabase.from("bookings")
      .select("*, lots(code), customers(code,full_name)")
      .in("project_id", projectIds).order("booking_date", { ascending: false })
      .then(({ data }) => setRows(data || []));
    if (projectId)
      supabase.from("lots").select("id,code").eq("project_id", projectId).eq("status", "available").order("code")
        .then(({ data }) => setLots(data || []));
    supabase.from("customers").select("id,code,full_name").order("code").limit(500)
      .then(({ data }) => setCusts(data || []));
  };
  useEffect(() => { load(); }, [projectIds]);

  // ມາຈາກຜັງຕອນດິນ (?lot=...) → ເປີດຟອມພ້ອມຕອນທີ່ເລືອກ
  useEffect(() => {
    const lotId = new URLSearchParams(window.location.search).get("lot");
    if (lotId) {
      setForm({ booking_date: new Date().toISOString().slice(0, 10), status: "active", mode: "new", currency: "LAK", lot_id: lotId });
      window.history.replaceState({}, "", "/bookings");
    }
  }, []);

  const save = async (e) => {
    e.preventDefault();
    // 1) ລູກຄ້າ: ໃໝ່ = ສ້າງພ້ອມລະຫັດ auto · ເກົ່າ = ໃຊ້ id ທີ່ເລືອກ
    let customerId = form.customer_id;
    if (form.mode !== "old") {
      const { data: code, error: e0 } = await supabase.rpc("next_customer_code");
      if (e0) return alert("ອອກລະຫັດລູກຄ້າບໍ່ໄດ້: " + e0.message);
      const full_name = [form.first_name, form.last_name].filter(Boolean).join(" ");
      const { data: cu, error: e1 } = await supabase.from("customers")
        .insert({ code, first_name: form.first_name, last_name: form.last_name || null, full_name, tel: form.tel || null })
        .select("id").single();
      if (e1) return alert("ບັນທຶກລູກຄ້າຜິດພາດ: " + e1.message);
      customerId = cu.id;
    }
    if (!customerId) return alert("ກະລຸນາເລືອກລູກຄ້າ");
    // 2) ອອກເລກໃບຈອງ 2026-001 (atomic ກັນເລກຊ້ຳ)
    const { data: bookingNo, error: numErr } = await supabase.rpc("next_doc_no", { p_doc_type: "booking" });
    if (numErr) return alert("ອອກເລກໃບຈອງບໍ່ໄດ້: " + numErr.message);
    // 3) ບັນທຶກໃບຈອງ — ພະນັກງານຂາຍດຶງ auto ຈາກ account ທີ່ login
    const { error } = await supabase.from("bookings").insert({
      booking_no: bookingNo, project_id: projectId, lot_id: form.lot_id,
      customer_id: customerId, booking_date: form.booking_date,
      deposit_amount: form.deposit_amount, currency: form.currency || "LAK",
      deposit1_date: form.booking_date,
      deposit2_amount: form.deposit2_amount || null, deposit2_date: form.contract_due_date || null,
      deposit3_amount: null, deposit3_date: null,
      deposit_note: form.deposit_note || null,
      contract_due_date: form.contract_due_date, status: "active",
      sales_person: profile?.full_name || null,
    });
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
  const isNew = form?.mode !== "old";

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-navy">ໃບສັນຍາມັດຈຳເງິນຄ່າດິນ</h2>
        <button className="btn-p" onClick={() => projectId
          ? setForm({ booking_date: today, status: "active", mode: "new", currency: "LAK" })
          : alert("ກະລຸນາເລືອກໂຄງການດຽວກ່ອນ ຈຶ່ງອອກໃບສັນຍາມັດຈຳໄດ້")}>+ ອອກໃບສັນຍາມັດຈຳ</button>
      </div>
      <Table cols={["ເລກທີ", "ລູກຄ້າ", "ຕອນ", "ວັນທີ", "ເງິນມັດຈຳ", "ກຳນົດເຮັດສັນຍາ", "ສະຖານະ", ""]}
        rows={rows.map((b) => {
          const over = b.status === "active" && b.contract_due_date < today;
          return [
            <b key="n">{b.booking_no}</b>, b.customers?.full_name, b.lots?.code,
            fdate(b.booking_date), fmt(b.deposit_amount, b.currency),
            <span key="d" className={over ? "text-brand-red font-semibold" : ""}>{fdate(b.contract_due_date)}{over && " ⚠"}</span>,
            <Badge key="s" color={over ? "red" : ST_COLOR[b.status]}>{over ? "ກາຍກຳນົດ" : BOOKING_STATUS[b.status]}</Badge>,
            <span key="a" className="flex gap-1">
              <a className="btn-o !py-1 !px-2 text-xs" href={`/print/deposit/${b.id}`} target="_blank">🖨 ໃບສັນຍາມັດຈຳ</a>
              {b.status === "active" && (<>
                <button className="btn-p !py-1 !px-2 text-xs" onClick={() => setStatus(b, "converted")}>ເຮັດສັນຍາແລ້ວ</button>
                <button className="btn-o !py-1 !px-2 text-xs" onClick={() => setStatus(b, "cancelled")}>ຍົກເລີກ</button>
              </>)}
            </span>,
          ];
        })} />

      <Modal open={!!form} title="ອອກໃບສັນຍາມັດຈຳເງິນຄ່າດິນ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ເລກທີ"><input className="inp bg-slate-50" disabled value="ອອກອັດຕະໂນມັດ (2026-XXX)" /></Field>
            <Field label="ວັນທີຈອງ *"><input className="inp" type="date" required value={form.booking_date || ""} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} /></Field>
            <Field label="ຕອນດິນ (ສະເພາະທີ່ຫວ່າງ) *">
              <select className="inp" required value={form.lot_id || ""} onChange={(e) => setForm({ ...form, lot_id: e.target.value })}>
                <option value="">— ເລືອກ —</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
              </select>
            </Field>
            <Field label="ລູກຄ້າ">
              <div className="flex gap-3 items-center h-full text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={isNew} onChange={() => setForm({ ...form, mode: "new", customer_id: null })} /> ລູກຄ້າໃໝ່</label>
                <label className="flex items-center gap-1"><input type="radio" checked={!isNew} onChange={() => setForm({ ...form, mode: "old" })} /> ລູກຄ້າເກົ່າ</label>
              </div>
            </Field>
            {isNew ? (<>
              <Field label="ຊື່ *"><input className="inp" required value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
              <Field label="ນາມສະກຸນ"><input className="inp" value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
              <Field label="ເບີໂທ"><input className="inp" value={form.tel || ""} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
            </>) : (
              <Field label="ເລືອກລູກຄ້າ *">
                <select className="inp" required value={form.customer_id || ""} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">— ເລືອກ —</option>
                  {custs.map((c) => <option key={c.id} value={c.id}>{c.code} {c.full_name}</option>)}
                </select>
              </Field>
            )}
            <Field label="ເງິນມັດຈຳ ງວດ 1 * (ຈ່າຍມື້ອອກໃບ)"><input className="inp" type="number" required value={form.deposit_amount || ""} onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} /></Field>
            <Field label="ມັດຈຳ ງວດ 2 (ຈ່າຍມື້ເຮັດສັນຍາ)"><input className="inp" type="number" value={form.deposit2_amount || ""} onChange={(e) => setForm({ ...form, deposit2_amount: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ກຳນົດມື້ເຮັດສັນຍາ *"><input className="inp" type="date" required value={form.contract_due_date || ""} onChange={(e) => setForm({ ...form, contract_due_date: e.target.value })} /></Field>
            <Field label="ໝາຍເຫດມັດຈຳ" ><input className="inp" value={form.deposit_note || ""} onChange={(e) => setForm({ ...form, deposit_note: e.target.value })} /></Field>
            <Field label="ພະນັກງານຂາຍ (auto)"><input className="inp bg-slate-50" disabled value={profile?.full_name || "—"} /></Field>
            <div className="col-span-2 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
              ຄີພຽງຂໍ້ມູນພື້ນຖານ — ລາຍລະອຽດອື່ນຕື່ມຕອນສັ່ງປຣິນໃບສັນຍາມັດຈຳ · ບັນທຶກແລ້ວຕອນດິນປ່ຽນເປັນ "ຈອງ" ອັດຕະໂນມັດ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ + ອອກໃບສັນຍາມັດຈຳ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Bookings /></Shell>; }
