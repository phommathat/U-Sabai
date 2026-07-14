"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt } from "@/lib/fmt";

const LOT_CLS = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-300",
  reserved: "bg-slate-100 text-slate-600 border-slate-300",
  sold: "bg-red-50 text-red-700 border-red-300",
};
const LOT_LAO = { available: "ຫວ່າງ", reserved: "ຈອງ", sold: "ຂາຍແລ້ວ" };

function Lots() {
  const { projectId } = useApp();
  const [lots, setLots] = useState([]);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(null);

  const load = () =>
    projectId &&
    supabase.from("lots").select("*").eq("project_id", projectId).order("code")
      .then(({ data }) => setLots(data || []));
  useEffect(() => { load(); }, [projectId]);

  const save = async (e) => {
    e.preventDefault();
    const row = { ...form, project_id: projectId };
    const { error } = row.id
      ? await supabase.from("lots").update(row).eq("id", row.id)
      : await supabase.from("lots").insert(row);
    if (error) alert("ຜິດພາດ: " + error.message);
    else { setForm(null); load(); }
  };

  const zones = [...new Set(lots.map((l) => l.zone || "?"))].sort();

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-navy">ຜັງຕອນດິນ ({lots.length} ຕອນ)</h2>
        <div className="flex gap-2 items-center text-xs">
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-emerald-500 inline-block" />ຫວ່າງ</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-slate-400 inline-block" />ຈອງ</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-red-500 inline-block" />ຂາຍແລ້ວ</span>
          <button className="btn-p ml-3" onClick={() => setForm({ status: "available", currency: "THB" })}>+ ເພີ່ມຕອນດິນ</button>
        </div>
      </div>

      {zones.map((z) => (
        <div key={z} className="card mb-4">
          <div className="text-xs text-slate-500 mb-2 font-semibold">ໂຊນ {z} — {lots.filter((l) => (l.zone || "?") === z).length} ຕອນ</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))" }}>
            {lots.filter((l) => (l.zone || "?") === z).map((l) => (
              <button key={l.id} onClick={() => setSel(l)}
                className={`rounded-lg border p-2 text-center hover:scale-105 transition ${LOT_CLS[l.status]}`}>
                <div className="font-bold text-[13px]">{l.code}</div>
                <div className="text-[10px] opacity-75">{Number(l.size_sqm)} ຕລມ</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!sel} title={`ຕອນ ${sel?.code}`} onClose={() => setSel(null)}>
        {sel && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-dashed pb-2"><span>ເນື້ອທີ່</span><b>{Number(sel.size_sqm)} ຕລມ</b></div>
            <div className="flex justify-between border-b border-dashed pb-2"><span>ລາຄາຕັ້ງ</span><b>{fmt(sel.list_price, sel.currency)}</b></div>
            <div className="flex justify-between border-b border-dashed pb-2"><span>ສະຖານະ</span><Badge color={sel.status === "sold" ? "red" : sel.status === "reserved" ? "gray" : "green"}>{LOT_LAO[sel.status]}</Badge></div>
            <div className="flex justify-between border-b border-dashed pb-2"><span>ໃບຕາດິນແມ່</span><b>{sel.parent_deed_no || "—"}</b></div>
            <button className="btn-o w-full mt-2" onClick={() => { setForm(sel); setSel(null); }}>ແກ້ໄຂ</button>
          </div>
        )}
      </Modal>

      <Modal open={!!form} title={form?.id ? `ແກ້ໄຂຕອນ ${form.code}` : "ເພີ່ມຕອນດິນ"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ລະຫັດຕອນ *"><input className="inp" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="ໂຊນ"><input className="inp" value={form.zone || ""} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></Field>
            <Field label="ເນື້ອທີ່ (ຕລມ) *"><input className="inp" type="number" step="0.01" required value={form.size_sqm || ""} onChange={(e) => setForm({ ...form, size_sqm: e.target.value })} /></Field>
            <Field label="ລາຄາ/ຕລມ"><input className="inp" type="number" value={form.price_per_sqm || ""} onChange={(e) => setForm({ ...form, price_per_sqm: e.target.value })} /></Field>
            <Field label="ລາຄາຕັ້ງ *"><input className="inp" type="number" required value={form.list_price || ""} onChange={(e) => setForm({ ...form, list_price: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency || "THB"} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>THB</option><option>LAK</option><option>USD</option>
              </select>
            </Field>
            <Field label="ສະຖານະ">
              <select className="inp" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="available">ຫວ່າງ</option><option value="reserved">ຈອງ</option><option value="sold">ຂາຍແລ້ວ</option>
              </select>
            </Field>
            <Field label="ໃບຕາດິນແມ່"><input className="inp" value={form.parent_deed_no || ""} onChange={(e) => setForm({ ...form, parent_deed_no: e.target.value })} /></Field>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Lots /></Shell>; }
