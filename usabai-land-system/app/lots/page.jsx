"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, DEED_STAGE } from "@/lib/fmt";

const LOT_CLS = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-300",
  reserved: "bg-slate-100 text-slate-600 border-slate-300",
  sold: "bg-red-50 text-red-700 border-red-300",
};
const LOT_LAO = { available: "ຫວ່າງ", reserved: "ຈອງ", sold: "ຂາຍແລ້ວ" };

const Row = ({ l, children }) => (
  <div className="flex justify-between border-b border-dashed pb-2 gap-4"><span className="text-slate-500 shrink-0">{l}</span><b className="text-right">{children ?? "—"}</b></div>
);

function Lots() {
  const { projectId, projectIds, projects } = useApp();
  const [lots, setLots] = useState([]);
  const [sel, setSel] = useState(null);      // ຕອນທີ່ click
  const [detail, setDetail] = useState(null); // ຂໍ້ມູນຈາກ v_lot_detail
  const [form, setForm] = useState(null);

  const load = () =>
    projectIds.length &&
    supabase.from("lots").select("*").in("project_id", projectIds).order("code")
      .then(({ data }) => setLots(data || []));
  useEffect(() => { load(); }, [projectIds]);
  const pcode = (id) => projects.find((p) => p.id === id)?.code || "";

  // click ຕອນ → ດຶງລາຍລະອຽດ (ສັນຍາ/ລູກຄ້າ/ຍອດຊຳລະ/ໃບຕາດິນ/ໃບຈອງ)
  const open = async (l) => {
    setSel(l); setDetail(null);
    const { data } = await supabase.from("v_lot_detail").select("*").eq("lot_id", l.id).limit(1);
    setDetail(data?.[0] || {});
  };

  const save = async (e) => {
    e.preventDefault();
    const row = { ...form, project_id: form.project_id || projectId }; // ແກ້ໄຂຕອນເກົ່າ = ຄົງໂຄງການເດີມ
    const { error } = row.id
      ? await supabase.from("lots").update(row).eq("id", row.id)
      : await supabase.from("lots").insert(row);
    if (error) alert("ຜິດພາດ: " + error.message);
    else { setForm(null); load(); }
  };

  // ຫຼາຍໂຄງການ → ຈັດກຸ່ມເປັນ "P01 · ໂຊນ A" ກັນລະຫັດຕອນຊ້ຳກັນຂ້າມໂຄງການ
  const zkey = (l) => (projectIds.length > 1 ? `${pcode(l.project_id)} · ` : "") + (l.zone || "?");
  const zones = [...new Set(lots.map(zkey))].sort();
  const d = detail;

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-bold text-navy">ຜັງຕອນດິນ ({lots.length} ຕອນ)</h2>
        <div className="flex gap-2 items-center text-xs">
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-emerald-500 inline-block" />ຫວ່າງ</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-slate-400 inline-block" />ຈອງ</span>
          <span className="flex items-center gap-1"><i className="w-3 h-3 rounded bg-red-500 inline-block" />ຂາຍແລ້ວ</span>
          <button className="btn-p ml-3" onClick={() => projectId
            ? setForm({ status: "available", currency: "THB" })
            : alert("ກະລຸນາເລືອກໂຄງການດຽວກ່ອນ ຈຶ່ງເພີ່ມຕອນດິນໄດ້")}>+ ເພີ່ມຕອນດິນ</button>
        </div>
      </div>

      {zones.map((z) => (
        <div key={z} className="card mb-4">
          <div className="text-xs text-slate-500 mb-2 font-semibold">ໂຊນ {z} — {lots.filter((l) => zkey(l) === z).length} ຕອນ</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))" }}>
            {lots.filter((l) => zkey(l) === z).map((l) => (
              <button key={l.id} onClick={() => open(l)}
                className={`rounded-lg border p-2 text-center hover:scale-105 transition ${LOT_CLS[l.status]}`}>
                <div className="font-bold text-[13px]">{l.code}</div>
                <div className="text-[10px] opacity-75">{Number(l.size_sqm)} ຕລມ</div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!sel} title={`ຕອນ ${sel?.code} — ${LOT_LAO[sel?.status] || ""}`} onClose={() => setSel(null)}>
        {sel && !d && <div className="text-center text-slate-400 py-6">ກຳລັງໂຫຼດ...</div>}
        {sel && d && (
          <div className="space-y-2 text-sm">
            <Row l="ເນື້ອທີ່">{Number(sel.size_sqm)} ຕລມ</Row>
            <Row l="ລາຄາຕັ້ງ">{fmt(sel.list_price, sel.currency)}</Row>
            <Row l="ສະຖານະ"><Badge color={sel.status === "sold" ? "red" : sel.status === "reserved" ? "gray" : "green"}>{LOT_LAO[sel.status]}</Badge></Row>

            {/* ຂາຍແລ້ວ: ລູກຄ້າ + ຍອດຊຳລະ + ໃບຕາດິນ */}
            {sel.status === "sold" && d.contract_id && (<>
              <Row l="ລູກຄ້າ">{d.full_name}</Row>
              <Row l="ເບີໂທ">{d.tel}</Row>
              <Row l="ເລກສັນຍາ">{d.contract_no} ({fdate(d.sign_date)})</Row>
              <Row l="ຊຳລະແລ້ວ">
                <span>{fmt(d.total_paid, d.contract_currency)} <span className="text-brand-green">({d.pct_paid || 0}%)</span></span>
              </Row>
              <Row l="ຍອດຄ້າງ">
                {(d.pct_paid || 0) >= 100
                  ? <span className="text-brand-green">ຄົບແລ້ວ ✓</span>
                  : <span className="text-brand-red">{fmt(d.balance, d.contract_currency)}</span>}
              </Row>
              <Row l="ໃບຕາດິນ">
                <Badge color={d.deed_stage === "handed_over" ? "green" : d.deed_stage ? "blue" : "gray"}>
                  {DEED_STAGE[d.deed_stage] || (d.deed_eligible ? "ຮອດເກນ 20% — ຍັງບໍ່ເລີ່ມແລ່ນ" : "ຍັງບໍ່ຮອດເກນ 20%")}
                </Badge>
              </Row>
              {d.new_deed_no && <Row l="ເລກໃບຕາດິນໃໝ່">{d.new_deed_no}</Row>}
            </>)}

            {/* ຈອງ: ຂໍ້ມູນຜູ້ຈອງ */}
            {sel.status === "reserved" && d.booking_id && (<>
              <Row l="ຜູ້ຈອງ">{d.booking_customer_name}</Row>
              <Row l="ເບີໂທ">{d.booking_customer_tel}</Row>
              <Row l="ເລກໃບຈອງ">{d.booking_no} ({fdate(d.booking_date)})</Row>
              <Row l="ເງິນມັດຈຳ">{fmt(d.deposit_amount)}</Row>
              <Row l="ກຳນົດເຮັດສັນຍາ">{fdate(d.contract_due_date)}</Row>
            </>)}

            {/* ປຸ່ມຕາມສະຖານະ */}
            <div className="flex gap-2 pt-3">
              {sel.status === "available" && (<>
                <a className="btn-p flex-1 text-center" href={`/bookings?lot=${sel.id}`}>📌 ດຳເນີນການຈອງ</a>
                <a className="btn-p flex-1 text-center" href={`/contracts?lot=${sel.id}`}>📄 ເຮັດສັນຍາ</a>
              </>)}
              {sel.status === "reserved" && (
                <a className="btn-p flex-1 text-center" href={`/contracts?lot=${sel.id}`}>📄 ເຮັດສັນຍາ</a>
              )}
              {sel.status === "sold" && d.contract_id && (
                <a className="btn-o flex-1 text-center" href={`/print/contract/${d.contract_id}`} target="_blank">🖨 ສັນຍາ</a>
              )}
              <button className="btn-o flex-1" onClick={() => { setForm(sel); setSel(null); }}>✏️ ແກ້ໄຂຕອນ</button>
            </div>
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
