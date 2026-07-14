"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";

function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);

  const load = () =>
    supabase.from("customers").select("*").order("code").limit(500)
      .then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const { error } = form.id
      ? await supabase.from("customers").update(form).eq("id", form.id)
      : await supabase.from("customers").insert(form);
    if (error) alert("ຜິດພາດ: " + error.message);
    else { setForm(null); load(); }
  };

  const list = rows.filter((r) => !q || r.full_name?.includes(q) || r.tel?.includes(q) || r.code?.includes(q));

  return (
    <>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <h2 className="text-lg font-bold text-navy">ລູກຄ້າ ({rows.length})</h2>
        <input className="inp !w-64 ml-auto" placeholder="🔍 ຄົ້ນຫາ ຊື່/ເບີໂທ/ລະຫັດ..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-p" onClick={() => setForm({})}>+ ເພີ່ມລູກຄ້າ</button>
      </div>
      <Table cols={["ລະຫັດ", "ຊື່ ແລະ ນາມສະກຸນ", "ເບີໂທ", "ບ້ານ/ເມືອງ", ""]}
        rows={list.slice(0, 100).map((c) => [
          c.code, <b key="n">{c.full_name}</b>, c.tel || "—",
          [c.village, c.district].filter(Boolean).join(", ") || "—",
          <button key="e" className="btn-o !py-1 !px-3 text-xs" onClick={() => setForm(c)}>ແກ້ໄຂ</button>,
        ])} />

      <Modal open={!!form} title={form?.id ? "ແກ້ໄຂລູກຄ້າ" : "ເພີ່ມລູກຄ້າ"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ລະຫັດ *"><input className="inp" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="ຊື່ ແລະ ນາມສະກຸນ *"><input className="inp" required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="ເບີໂທ"><input className="inp" value={form.tel || ""} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
            <Field label="ເລກບັດປະຈຳຕົວ"><input className="inp" value={form.id_card_no || ""} onChange={(e) => setForm({ ...form, id_card_no: e.target.value })} /></Field>
            <Field label="ບ້ານ"><input className="inp" value={form.village || ""} onChange={(e) => setForm({ ...form, village: e.target.value })} /></Field>
            <Field label="ເມືອງ"><input className="inp" value={form.district || ""} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
            <Field label="ແຂວງ"><input className="inp" value={form.province || ""} onChange={(e) => setForm({ ...form, province: e.target.value })} /></Field>
            <Field label="ອາຊີບ"><input className="inp" value={form.occupation || ""} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></Field>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Customers /></Shell>; }
