"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table, Pager, usePager } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fdate } from "@/lib/fmt";

const STAGES = [
  ["not_eligible", "ຍັງບໍ່ຮອດເກນ 20%", "gray"],
  ["doc_prep", "ກຽມເອກະສານ/ຍື່ນຟອມ", "amber"],
  ["submitted", "ຍື່ນຫ້ອງການທີ່ດິນ", "blue"],
  ["processing", "ກຳລັງດຳເນີນການ", "navy"],
  ["issued", "ອອກໃບຕາດິນແລ້ວ", "blue"],
  ["handed_over", "ສົ່ງມອບແລ້ວ", "green"],
];
const SNAME = Object.fromEntries(STAGES.map(([k, l]) => [k, l]));
const SCOLOR = Object.fromEntries(STAGES.map(([k, , c]) => [k, c]));

function Deeds() {
  const { projectIds } = useApp();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);

  const load = () =>
    projectIds.length &&
    supabase.from("v_deed_pipeline").select("*").in("project_id", projectIds)
      .order("pct_paid", { ascending: false }).limit(2000)
      .then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, [projectIds]);

  const openDeed = async (r) => {
    const { data, error } = await supabase.from("title_deeds")
      .insert({ contract_id: r.contract_id, stage: "doc_prep", eligible_date: new Date().toISOString().slice(0, 10) })
      .select().single();
    if (error) return alert("ຜິດພາດ: " + error.message);
    await supabase.from("title_deed_history").insert({ deed_id: data.id, from_stage: "not_eligible", to_stage: "doc_prep" });
    load();
  };

  const save = async (e) => {
    e.preventDefault();
    const { deed_id, old_stage, ...fields } = form;
    const { error } = await supabase.from("title_deeds").update(fields).eq("id", deed_id);
    if (error) return alert("ຜິດພາດ: " + error.message);
    if (fields.stage !== old_stage)
      await supabase.from("title_deed_history").insert({ deed_id, from_stage: old_stage, to_stage: fields.stage });
    setForm(null); load();
  };

  const counts = Object.fromEntries(STAGES.map(([k]) => [k, 0]));
  rows.forEach((r) => { counts[r.deed_id ? r.stage : "not_eligible"]++; });

  const pg = usePager(rows, [projectIds]); // 50 ສັນຍາ/ໜ້າ

  return (
    <>
      <h2 className="text-lg font-bold text-navy mb-3">ຕິດຕາມໃບຕາດິນ</h2>
      <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 mb-4">
        📜 ເກນເລີ່ມແລ່ນໃບຕາດິນ: ຊຳລະຄົບ 20% ຂຶ້ນໄປ (ນັບ ເງິນມັດຈຳຈອງ + ເງິນມື້ເຮັດສັນຍາ ນຳ) — ສັນຍາທີ່ຮອດເກນຈະມີປຸ່ມ "ເລີ່ມຕົ້ນແລ່ນໃບຕາດິນ"
      </div>
      <div className="grid gap-3 grid-cols-3 lg:grid-cols-6 mb-5">
        {STAGES.map(([k, l]) => (
          <div key={k} className="card text-center !p-3">
            <div className="text-xl font-bold text-navy">{counts[k]}</div>
            <div className="text-[10.5px] text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ຕອນ", "% ຊຳລະ", "ຄວາມຄືບໜ້າປັດຈຸບັນ", "ໃບຕາດິນໃໝ່", "ສົ່ງມອບ", ""]}
        rows={pg.rows.map((r) => [
          <b key="n">{r.contract_no}</b>, r.full_name, r.lot_code,
          <span key="p" className={r.deed_eligible ? "text-brand-green font-bold" : "text-slate-400"}>{r.pct_paid}%{r.deed_eligible && " ✓"}</span>,
          <Badge key="s" color={SCOLOR[r.deed_id ? r.stage : "not_eligible"]}>{SNAME[r.deed_id ? r.stage : "not_eligible"]}</Badge>,
          r.new_deed_no || "—",
          r.handover_date ? `${fdate(r.handover_date)} (${r.received_by || "?"})` : "—",
          !r.deed_id && r.deed_eligible ? (
            <button key="a" className="btn-p !py-1 !px-3 text-xs" onClick={() => openDeed(r)}>ເລີ່ມຕົ້ນແລ່ນໃບຕາດິນ</button>
          ) : r.deed_id ? (
            <span key="a" className="flex gap-1">
              <button className="btn-o !py-1 !px-3 text-xs"
                onClick={() => setForm({ deed_id: r.deed_id, old_stage: r.stage, stage: r.stage,
                  doc_prep_date: r.doc_prep_date, submit_date: r.submit_date, issue_date: r.issue_date,
                  new_deed_no: r.new_deed_no, handover_date: r.handover_date, received_by: r.received_by, note: r.deed_note })}>
                ອັບເດດຄວາມຄືບໜ້າ
              </button>
              {r.stage === "handed_over" && (
                <a className="btn-o !py-1 !px-3 text-xs" href={`/print/handover/${r.deed_id}`} target="_blank">🖨 ໃບມອບຮັບ</a>
              )}
            </span>
          ) : null,
        ])} />
      <Pager pg={pg} unit="ສັນຍາ" />

      <Modal open={!!form} title="ອັບເດດຄວາມຄືບໜ້າໃບຕາດິນ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ຄວາມຄືບໜ້າປັດຈຸບັນ *">
              <select className="inp" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.slice(1).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="ເລກໃບຕາດິນໃໝ່"><input className="inp" value={form.new_deed_no || ""} onChange={(e) => setForm({ ...form, new_deed_no: e.target.value })} /></Field>
            <Field label="ວັນທີກຽມເອກະສານ"><input className="inp" type="date" value={form.doc_prep_date || ""} onChange={(e) => setForm({ ...form, doc_prep_date: e.target.value })} /></Field>
            <Field label="ວັນທີຍື່ນຫ້ອງການທີ່ດິນ"><input className="inp" type="date" value={form.submit_date || ""} onChange={(e) => setForm({ ...form, submit_date: e.target.value })} /></Field>
            <Field label="ວັນທີອອກໃບຕາດິນ"><input className="inp" type="date" value={form.issue_date || ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
            <Field label="ວັນທີສົ່ງມອບ"><input className="inp" type="date" value={form.handover_date || ""} onChange={(e) => setForm({ ...form, handover_date: e.target.value })} /></Field>
            <Field label="ຜູ້ຮັບມອບ"><input className="inp" value={form.received_by || ""} onChange={(e) => setForm({ ...form, received_by: e.target.value })} /></Field>
            <Field label="ໝາຍເຫດ"><input className="inp" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Deeds /></Shell>; }
