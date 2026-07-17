"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table, KPI } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fmtM, fdate } from "@/lib/fmt";

const CATS = [
  ["land_purchase", "ຊື້ດິນ", "navy"], ["development", "ພັດທະນາ", "blue"],
  ["marketing", "ການຕະຫຼາດ", "amber"], ["title_deed", "ໃບຕາດິນ", "gray"],
  ["admin", "ບໍລິຫານ", "gray"], ["other", "ອື່ນໆ", "gray"],
];
const CNAME = Object.fromEntries(CATS.map(([k, l]) => [k, l]));
const CCOLOR = Object.fromEntries(CATS.map(([k, , c]) => [k, c]));

function Costs() {
  const { projectId, projectIds, projects } = useApp();
  const [rows, setRows] = useState([]);
  const [lots, setLots] = useState([]);
  const [fx, setFx] = useState({ LAK: 1 });
  const [form, setForm] = useState(null);

  const load = () => {
    if (!projectIds.length) return;
    supabase.from("costs").select("*").in("project_id", projectIds)
      .order("cost_date", { ascending: false }).then(({ data }) => setRows(data || []));
    supabase.from("lots").select("list_price,currency,project_id").in("project_id", projectIds)
      .then(({ data }) => setLots(data || []));
  };
  useEffect(() => { load(); }, [projectIds]);
  useEffect(() => {
    supabase.from("fx_rates").select("currency,rate_to_lak").then(({ data }) => {
      const m = { LAK: 1 };
      (data || []).forEach((r) => { m[r.currency] = Number(r.rate_to_lak); });
      setFx(m);
    });
  }, []);
  const toLAK = (amt, cur) => Number(amt || 0) * (fx[cur || "LAK"] || 1);

  const save = async (e) => {
    e.preventDefault();
    if (!projectId) return alert("ກະລຸນາເລືອກໂຄງການດຽວກ່ອນ ຈຶ່ງບັນທຶກຕົ້ນທຶນໄດ້");
    const { error } = await supabase.from("costs").insert({ ...form, project_id: projectId });
    if (error) return alert("ຜິດພາດ: " + error.message);
    setForm(null); load();
  };
  const del = async (id) => {
    if (!confirm("ລຶບລາຍການນີ້?")) return;
    await supabase.from("costs").delete().eq("id", id); load();
  };

  const sumCat = (k) => rows.filter((r) => r.category === k).reduce((s, r) => s + toLAK(r.amount, r.currency), 0);
  const total = rows.reduce((s, r) => s + toLAK(r.amount, r.currency), 0);
  const valByCur = lots.reduce((m, l) => {
    const c = l.currency || "LAK";
    m[c] = (m[c] || 0) + Number(l.list_price);
    return m;
  }, {});
  const saleLAK = lots.reduce((s, l) => s + toLAK(l.list_price, l.currency), 0);
  const profitLAK = saleLAK - total;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-navy">ສະຫຼຸບການລົງທຶນ</h2>
        <button className="btn-p" onClick={() => setForm({ cost_date: new Date().toISOString().slice(0, 10), category: "development", currency: "LAK" })}>+ ບັນທຶກລາຍຈ່າຍ</button>
      </div>
      {/* ໝວດທຳອິດ = ລາຄາຊື້ດິນ */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5 mb-5">
        <KPI label="ລາຄາຊື້ດິນ" value={fmtM(sumCat("land_purchase"))} note="ໝວດ ຊື້ດິນ" />
        <KPI label="ພັດທະນາ" value={fmtM(sumCat("development"))} />
        <KPI label="ການຕະຫຼາດ" value={fmtM(sumCat("marketing"))} />
        <KPI label="ຄ່າແລ່ນໃບຕາດິນ" value={fmtM(sumCat("title_deed"))} />
        <KPI label="ຕົ້ນທຶນລວມ (ປ່ຽນເປັນກີບ)" value={fmtM(total)} note="ທຸກສະກຸນ → ກີບ" />
      </div>

      {/* ສະຫຼຸບແຍກຕາມໂຄງການ (ເມື່ອເລືອກຫຼາຍໂຄງການ) */}
      {projectIds.length > 1 && (
        <div className="card mb-5">
          <b className="text-navy text-sm">ສະຫຼຸບແຍກຕາມໂຄງການ (ປ່ຽນເປັນກີບ)</b>
          <Table cols={["ໂຄງການ", "ລາຄາຊື້ດິນ", "ຕົ້ນທຶນລວມ", "ມູນຄ່າຂາຍ", "ກຳໄລຄາດຄະເນ"]}
            rows={projectIds.map((pid) => {
              const pr = projects.find((p) => p.id === pid);
              const pc = rows.filter((r) => r.project_id === pid);
              const land = pc.filter((r) => r.category === "land_purchase").reduce((s, r) => s + toLAK(r.amount, r.currency), 0);
              const cost = pc.reduce((s, r) => s + toLAK(r.amount, r.currency), 0);
              const sale = lots.filter((l) => l.project_id === pid).reduce((s, l) => s + toLAK(l.list_price, l.currency), 0);
              const profit = sale - cost;
              return [
                <b key="p">{pr?.code} — {pr?.name}</b>,
                fmtM(land), fmtM(cost), fmtM(sale),
                <b key="f" className={profit < 0 ? "text-brand-red" : "text-brand-green"}>{fmtM(profit)}</b>,
              ];
            })} />
        </div>
      )}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-5">
        <KPI label="ມູນຄ່າຂາຍທັງໂຄງການ (ປ່ຽນເປັນກີບ)" value={fmtM(saleLAK)} note="ຈາກລາຄາຕັ້ງທຸກຕອນ" />
        <KPI label="ຕົ້ນທຶນລວມ (ປ່ຽນເປັນກີບ)" value={fmtM(total)} />
        <KPI label="ກຳໄລຄາດຄະເນ (ປ່ຽນເປັນກີບ)" value={fmtM(profitLAK)} warn={profitLAK < 0} note="ມູນຄ່າຂາຍ − ຕົ້ນທຶນ" />
      </div>
      <div className="card mb-5 text-sm">
        <b className="text-navy">ມູນຄ່າຂາຍແຍກຕາມສະກຸນ:</b>
        <span className="ml-3">{Object.entries(valByCur).filter(([, v]) => v > 0).map(([c, v]) => fmt(v, c)).join("  +  ") || "—"}</span>
        <span className="text-xs text-slate-400 ml-3">* ອັດຕາແລກປ່ຽນຈາກໜ້າ “ຕັ້ງຄ່າ” — ປັບໄດ້ທຸກເມື່ອ</span>
      </div>
      <Table cols={["ວັນທີ", "ໝວດ", "ລາຍການ", "ຈຳນວນເງິນ", "ຜູ້ຂາຍ/ຜູ້ຮັບເໝົາ", "ອ້າງອີງ", ""]}
        rows={rows.map((r) => [
          fdate(r.cost_date),
          <Badge key="c" color={CCOLOR[r.category]}>{CNAME[r.category]}</Badge>,
          r.description, <b key="a">{fmt(r.amount, r.currency)}</b>, r.vendor || "—", r.ref_doc || "—",
          <button key="d" className="text-brand-red text-xs" onClick={() => del(r.id)}>ລຶບ</button>,
        ])} />

      <Modal open={!!form} title="ບັນທຶກລາຍຈ່າຍ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ວັນທີ *"><input className="inp" type="date" required value={form.cost_date} onChange={(e) => setForm({ ...form, cost_date: e.target.value })} /></Field>
            <Field label="ໝວດ *">
              <select className="inp" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <div className="col-span-2"><Field label="ລາຍການ *"><input className="inp" required value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
            <Field label="ຈຳນວນເງິນ *"><input className="inp" type="number" required value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ຜູ້ຂາຍ/ຜູ້ຮັບເໝົາ"><input className="inp" value={form.vendor || ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
            <Field label="ເອກະສານອ້າງອີງ"><input className="inp" value={form.ref_doc || ""} onChange={(e) => setForm({ ...form, ref_doc: e.target.value })} /></Field>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Costs /></Shell>; }
