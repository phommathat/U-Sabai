"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate } from "@/lib/fmt";

// ຊ່ອງຄີຈຳນວນເງິນ: ໃສ່ຈຸດຂັ້ນຫຼັກພັນອັດຕະໂນມັດ ໃຫ້ຮູ້ຫຼັກເລກ
const MoneyInput = ({ value, onChange, ...props }) => (
  <input {...props} className="inp font-bold text-navy" inputMode="numeric"
    value={value === "" || value == null ? "" : Number(value).toLocaleString("en-US")}
    onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ""); onChange(raw === "" ? "" : Number(raw)); }} />
);

function Payments() {
  const { projectIds, projects } = useApp();
  const [inst, setInst] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [hist, setHist] = useState([]);
  const [soon, setSoon] = useState([]);         // ໃກ້ຮອດກຳນົດ 6 ວັນ
  const [paidFull, setPaidFull] = useState([]); // ຊຳລະຄົບ 100%
  const [form, setForm] = useState(null);
  const [addForm, setAddForm] = useState(null); // ຟອມເພີ່ມການຊຳລະງວດ (cascade)
  const [drill, setDrill] = useState(null);     // contract_id ທີ່ເປີດເບິ່ງລາຍບຸກຄົນ
  const [tab, setTab] = useState("history");    // default = ການຮັບເງິນ

  const load = async () => {
    if (!projectIds.length) return;
    const { data: cons } = await supabase.from("contracts")
      .select("id,contract_no,currency,sale_price,project_id, customers(full_name,tel), lots(code)").in("project_id", projectIds);
    setContracts(cons || []);
    const ids = (cons || []).map((c) => c.id);
    if (!ids.length) { setInst([]); setHist([]); setSoon([]); setPaidFull([]); return; }
    const { data: ins } = await supabase.from("installments")
      .select("*, payments(id, amount_received)").in("contract_id", ids)
      .order("due_date", { ascending: true, nullsFirst: false }).limit(1000);
    setInst(ins || []);
    const { data: pays } = await supabase.from("payments")
      .select("id,receipt_no,pay_date,amount_received,currency,channel,note,contract_id,installment_id,created_at")
      .in("contract_id", ids).neq("pay_date", "1900-01-01")
      .order("pay_date", { ascending: false }).limit(1000);
    setHist(pays || []);
    supabase.from("v_upcoming_installments_6d").select("*").in("project_id", projectIds)
      .order("due_date").then(({ data }) => setSoon(data || []));
    supabase.from("v_contracts_paid_full").select("*").in("project_id", projectIds)
      .order("contract_no").then(({ data }) => setPaidFull(data || []));
  };
  useEffect(() => { load(); }, [projectIds]);

  const today = new Date().toISOString().slice(0, 10);
  const cmap = Object.fromEntries(contracts.map((c) => [c.id, c]));
  const instMap = Object.fromEntries(inst.map((i) => [i.id, i])); // installment_id → ງວດ (ໃຊ້ທຽບກຳນົດຈ່າຍ)

  const enrich = inst.map((i) => {
    const paid = (i.payments || []).reduce((s, p) => s + Number(p.amount_received || 0), 0);
    const st = paid >= Number(i.amount_due) ? "paid"
      : i.due_date && i.due_date < today ? "overdue"
      : i.due_condition === "after_deed_transfer" ? "deed" : "due";
    return { ...i, paid, st, c: cmap[i.contract_id] };
  });
  const filtered = enrich.filter((i) => tab === "all" ? true : i.st === tab);

  // ຍອດຄ້າງ "ຫຼັງ" ແຕ່ລະການຮັບເງິນ (ສະສົມຕາມລຳດັບເວລາ) — ໃຊ້ໃນຖັນຍອດຄ້າງ + ໃບມອບຮັບເງິນ
  const remainAfter = {};
  {
    const byC = {};
    hist.forEach((p) => (byC[p.contract_id] = byC[p.contract_id] || []).push(p));
    Object.entries(byC).forEach(([cid, ps]) => {
      const sp = Number(cmap[cid]?.sale_price || 0);
      let cum = 0;
      [...ps].sort((a, b) => (a.pay_date + a.created_at).localeCompare(b.pay_date + b.created_at))
        .forEach((p) => { cum += Number(p.amount_received || 0); remainAfter[p.id] = sp - cum; });
    });
  }

  // ໝາຍເຫດ: ທຽບວັນຈ່າຍຈິງ ↔ ກຳນົດຈ່າຍຂອງງວດ
  const punctual = (p) => {
    const due = p.installment_id ? instMap[p.installment_id]?.due_date : null;
    if (!due) return p.note || "—";
    const days = Math.round((new Date(p.pay_date) - new Date(due)) / 86400000);
    return days <= 0
      ? <span className="text-brand-green">ຈ່າຍຕາມກຳນົດ ✓</span>
      : <span className="text-brand-red">ກາຍກຳນົດ {days} ວັນ</span>;
  };

  const receive = async (e) => {
    e.preventDefault();
    const { data: receiptNo, error: numErr } = await supabase.rpc("next_receipt_no");
    if (numErr) return alert("ອອກເລກໃບຮັບເງິນບໍ່ໄດ້: " + numErr.message);
    const { error } = await supabase.from("payments").insert({
      contract_id: form.contract_id, installment_id: form.installment_id,
      pay_date: form.pay_date, amount_received: form.amount_received,
      currency: form.currency, channel: form.channel, receipt_no: receiptNo, note: form.note || null,
    });
    if (error) return alert("ຜິດພາດ: " + error.message);
    setForm(null); load();
  };

  // ---- ຟອມເພີ່ມການຊຳລະງວດ: ໂຄງການ → ຕອນດິນ → ລູກຄ້າ/ງວດ auto ----
  const paidOf = (i) => (i.payments || []).reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const pickAddProj = async (pid) => {
    const { data } = await supabase.from("contracts")
      .select("id,contract_no,currency, customers(full_name), lots(code)")
      .eq("project_id", pid).neq("status", "cancelled").order("created_at", { ascending: false }).limit(300);
    setAddForm({ ...addForm, project_id: pid, contracts: data || [], contract_id: "", c: null, nextInst: null, amount_received: "" });
  };
  const pickAddContract = async (cid) => {
    const c = (addForm.contracts || []).find((x) => x.id === cid);
    const { data: ins } = await supabase.from("installments")
      .select("*, payments(amount_received)").eq("contract_id", cid).order("seq");
    // ງວດຕໍ່ໄປ = ງວດທຳອິດທີ່ຍັງຈ່າຍບໍ່ຄົບ (ຕໍ່ຈາກທີ່ຊຳລະຜ່ານມາ)
    const next = (ins || []).find((i) => paidOf(i) < Number(i.amount_due)) || null;
    setAddForm({
      ...addForm, contract_id: cid, c, nextInst: next,
      amount_received: next ? Number(next.amount_due) - paidOf(next) : "",
      currency: c?.currency || "LAK",
    });
  };
  const saveAdd = async (e) => {
    e.preventDefault();
    if (!addForm.contract_id) return alert("ກະລຸນາເລືອກຕອນດິນກ່ອນ");
    const { data: receiptNo, error: numErr } = await supabase.rpc("next_receipt_no");
    if (numErr) return alert("ອອກເລກໃບຮັບເງິນບໍ່ໄດ້: " + numErr.message);
    const { error } = await supabase.from("payments").insert({
      contract_id: addForm.contract_id, installment_id: addForm.nextInst?.id || null,
      pay_date: addForm.pay_date, amount_received: addForm.amount_received,
      currency: addForm.currency, channel: addForm.channel, receipt_no: receiptNo,
    });
    if (error) return alert("ຜິດພາດ: " + error.message);
    setAddForm(null); load();
  };

  const openReceive = (i, paid = 0) => setForm({
    contract_id: i.contract_id, installment_id: i.id, pay_date: today,
    amount_due: i.amount_due,
    amount_received: Number(i.amount_outstanding ?? (Number(i.amount_due) - paid)),
    currency: (cmap[i.contract_id]?.currency) || "LAK", channel: "ເງິນສົດ",
    label: `${cmap[i.contract_id]?.contract_no} · ${i.seq === 0 ? "ດາວ/ຈອງ" : "ງວດ " + i.seq}`,
  });

  const ST = {
    paid: <Badge color="green">ຈ່າຍແລ້ວ</Badge>, overdue: <Badge color="red">ຄ້າງຊຳລະ</Badge>,
    due: <Badge color="gray">ຍັງບໍ່ຮອດກຳນົດ</Badge>, deed: <Badge color="navy">ຈ່າຍຫຼັງໂອນໃບຕາດິນ</Badge>,
  };

  // ---- drill-down ລາຍບຸກຄົນ ----
  const dc = drill ? cmap[drill] : null;
  const dInst = drill ? enrich.filter((i) => i.contract_id === drill).sort((a, b) => a.seq - b.seq) : [];
  const dPays = drill ? hist.filter((p) => p.contract_id === drill) : [];
  const dPaid = dPays.reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const custBtn = (contractId, name) => (
    <button key="cu" className="text-navy underline decoration-dotted hover:text-brand-amber text-left font-semibold"
      onClick={() => setDrill(contractId)}>{name || "—"}</button>
  );

  const TABS = [
    ["history", "ການຮັບເງິນ"],
    ["soon", `ໃກ້ຮອດກຳນົດ 6 ວັນ${soon.length ? ` (${soon.length})` : ""}`],
    ["overdue", "ຄ້າງຊຳລະ"], ["paid100", "ຊຳລະຄົບ 100%"], ["all", "ທັງໝົດງວດ"],
  ];

  return (
    <>
      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-navy mr-auto">ການຊຳລະເງິນ</h2>
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-full text-xs border ${tab === k ? "bg-navy text-white border-navy" : "bg-white border-slate-300"}`}>{l}</button>
        ))}
        <button className="btn-p" onClick={() => setAddForm({ pay_date: today, channel: "ເງິນສົດ", currency: "LAK" })}>+ ເພີ່ມການຊຳລະງວດ</button>
      </div>

      {tab === "history" && (
        <Table cols={["ຊື່ລູກຄ້າ", "ຈຳນວນເງິນ", "ຍອດຄ້າງ", "ເລກທີໃບຮັບເງິນ", "ເລກທີສັນຍາ", "ວັນທີຮັບເງິນ", "ໝາຍເຫດ", ""]}
          empty="ຍັງບໍ່ມີການຮັບເງິນ"
          rows={hist.slice(0, 500).map((p) => [
            custBtn(p.contract_id, cmap[p.contract_id]?.customers?.full_name),
            <b key="a">{fmt(p.amount_received, p.currency)}</b>,
            remainAfter[p.id] > 0
              ? <span key="r" className="text-brand-red">{fmt(remainAfter[p.id], cmap[p.contract_id]?.currency)}</span>
              : <span key="r" className="text-brand-green">ຄົບແລ້ວ ✓</span>,
            p.receipt_no || "—", cmap[p.contract_id]?.contract_no, fdate(p.pay_date),
            punctual(p),
            <span key="pr" className="flex gap-1">
              <a className="btn-o !py-1 !px-2 text-sm" title="ພິມໃບມອບຮັບເງິນ" href={`/print/receipt/${p.id}`} target="_blank">🖨</a>
              <a className="btn-o !py-1 !px-2 text-sm" title="ບັນທຶກເປັນ PDF ສົ່ງລູກຄ້າ" href={`/print/receipt/${p.id}?auto=1`} target="_blank">📄</a>
            </span>,
          ])} />
      )}

      {tab === "soon" && (
        <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ເບີໂທ", "ງວດ", "ຄົບກຳນົດ", "ອີກ (ວັນ)", "ຍອດຄ້າງງວດ", ""]}
          empty="ບໍ່ມີງວດຄົບກຳນົດພາຍໃນ 6 ວັນ"
          rows={soon.map((i) => [
            i.contract_no, custBtn(i.contract_id, i.full_name), i.tel || "—",
            i.seq === 0 ? "ດາວ/ຈອງ" : `ງວດ ${i.seq}`, fdate(i.due_date),
            <Badge key="d" color={i.days_left <= 2 ? "red" : "amber"}>{i.days_left} ວັນ</Badge>,
            <b key="o">{fmt(i.amount_outstanding, i.currency)}</b>,
            <button key="r" className="btn-p !py-1 !px-3 text-xs" onClick={() => openReceive(i)}>ຮັບເງິນ</button>,
          ])} />
      )}

      {tab === "paid100" && (
        <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ເບີໂທ", "ຕອນ", "ມູນຄ່າສັນຍາ", "ຊຳລະແລ້ວ", "ໃບຕາດິນ"]}
          empty="ຍັງບໍ່ມີສັນຍາທີ່ຊຳລະຄົບ 100%"
          rows={paidFull.map((c) => [
            c.contract_no, custBtn(c.id, c.full_name), c.tel || "—", c.lot_code,
            fmt(c.sale_price, c.currency), <b key="p" className="text-brand-green">{fmt(c.total_paid, c.currency)} ✓</b>,
            c.deed_stage ? <Badge key="d" color={c.deed_stage === "handed_over" ? "green" : "blue"}>{c.deed_stage}</Badge> : <Badge key="d" color="gray">ຍັງບໍ່ເລີ່ມ</Badge>,
          ])} />
      )}

      {["overdue", "all"].includes(tab) && (
        <Table cols={["ສັນຍາ", "ລູກຄ້າ", "ງວດ", "ຄົບກຳນົດ", "ຕາມກຳນົດ", "ຮັບແລ້ວ", "ສະຖານະ", ""]}
          rows={filtered.slice(0, 120).map((i) => [
            i.c?.contract_no, custBtn(i.contract_id, i.c?.customers?.full_name),
            i.seq === 0 ? "ດາວ/ຈອງ" : `ງວດ ${i.seq}`,
            <span key="d" className={i.st === "overdue" ? "text-brand-red" : ""}>{fdate(i.due_date)}</span>,
            fmt(i.amount_due, i.c?.currency), fmt(i.paid || null, i.c?.currency), ST[i.st],
            i.st !== "paid" ? (
              <button key="r" className="btn-p !py-1 !px-3 text-xs" onClick={() => openReceive(i, i.paid)}>ຮັບເງິນ</button>
            ) : i.payments?.[0]?.id ? (
              <a key="r" className="btn-o !py-1 !px-3 text-xs" href={`/print/receipt/${i.payments[i.payments.length - 1].id}`} target="_blank">🖨</a>
            ) : null,
          ])} />
      )}

      {/* ---- Modal ລາຍບຸກຄົນ: ການຮັບເງິນກ່ອນ, ຕາຕະລາງງວດ (ແຜນຈ່າຍ) ຢູ່ລຸ່ມ ---- */}
      <Modal open={!!drill} title={dc ? `${dc.customers?.full_name} — ${dc.contract_no}` : ""} onClose={() => setDrill(null)} wide>
        {dc && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>ໂຄງການ: <b>{projects.find((p) => p.id === dc.project_id)?.name || "—"}</b></div>
              <div>ຕອນດິນ: <b>{dc.lots?.code || "—"}</b></div>
              <div>ເບີໂທ: <b>{dc.customers?.tel || "—"}</b></div>
              <div>ມູນຄ່າສັນຍາ: <b>{fmt(dc.sale_price, dc.currency)}</b></div>
              <div>ຊຳລະແລ້ວ: <b className="text-brand-green">{fmt(dPaid, dc.currency)}</b></div>
              <div>ຍອດຄ້າງ: <b className="text-brand-red">{fmt(Math.max(Number(dc.sale_price) - dPaid, 0), dc.currency)}</b></div>
            </div>
            <div>
              <div className="font-semibold text-navy mb-1">ການຮັບເງິນ ({dPays.length})</div>
              <Table cols={["ວັນທີ", "ເລກໃບຮັບເງິນ", "ຈຳນວນ", "ຍອດຄ້າງຫຼັງຈ່າຍ", "ໝາຍເຫດ", ""]}
                empty="ຍັງບໍ່ມີການຮັບເງິນ"
                rows={dPays.map((p) => [
                  fdate(p.pay_date), p.receipt_no || "—",
                  <b key="a">{fmt(p.amount_received, p.currency)}</b>,
                  remainAfter[p.id] > 0 ? fmt(remainAfter[p.id], dc.currency) : "ຄົບແລ້ວ ✓",
                  punctual(p),
                  <a key="pr" className="btn-o !py-0.5 !px-2 text-xs" href={`/print/receipt/${p.id}`} target="_blank">🖨</a>,
                ])} />
            </div>
            <div>
              <div className="font-semibold text-navy mb-1">ຕາຕະລາງງວດ — ແຜນກຳນົດຈ່າຍ ({dInst.length})</div>
              <Table cols={["ງວດ", "ຄົບກຳນົດ", "ຕາມກຳນົດ", "ຮັບແລ້ວ", "ຄ້າງ", "ສະຖານະ"]}
                empty="ບໍ່ມີງວດ (ຂໍ້ມູນ import ເກົ່າ)"
                rows={dInst.map((i) => [
                  i.seq === 0 ? "ດາວ/ຈອງ" : `ງວດ ${i.seq}`,
                  i.due_date ? fdate(i.due_date) : (i.due_condition === "after_deed_transfer" ? "ຫຼັງໂອນໃບຕາດິນ" : "—"),
                  fmt(i.amount_due, dc.currency), fmt(i.paid || null, dc.currency),
                  Number(i.amount_due) > i.paid ? <b key="o" className="text-brand-red">{fmt(Number(i.amount_due) - i.paid, dc.currency)}</b> : "—",
                  ST[i.st],
                ])} />
            </div>
          </div>
        )}
      </Modal>

      {/* ---- ຟອມເພີ່ມການຊຳລະງວດ: ເລືອກໂຄງການ → ຕອນດິນ → ລູກຄ້າ/ງວດ auto ---- */}
      <Modal open={!!addForm} title="💰 ເພີ່ມການຊຳລະງວດ" onClose={() => setAddForm(null)}>
        {addForm && (
          <form onSubmit={saveAdd} className="grid grid-cols-2 gap-3">
            <Field label="ໂຄງການ *">
              <select className="inp" required value={addForm.project_id || ""} onChange={(e) => pickAddProj(e.target.value)}>
                <option value="">— ເລືອກ —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </Field>
            <Field label="ຕອນດິນ *">
              <select className="inp" required value={addForm.contract_id || ""} onChange={(e) => pickAddContract(e.target.value)} disabled={!addForm.project_id}>
                <option value="">{addForm.project_id ? "— ເລືອກ —" : "ເລືອກໂຄງການກ່ອນ"}</option>
                {(addForm.contracts || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.lots?.code} — {c.customers?.full_name} ({c.contract_no})</option>
                ))}
              </select>
            </Field>
            <Field label="ຊື່ລູກຄ້າ (auto)"><input className="inp bg-slate-50" disabled value={addForm.c?.customers?.full_name || "—"} /></Field>
            <Field label="ງວດທີ (auto ຕໍ່ຈາກທີ່ຊຳລະຜ່ານມາ)">
              <input className="inp bg-slate-50" disabled value={
                !addForm.contract_id ? "—"
                : addForm.nextInst
                  ? `${addForm.nextInst.seq === 0 ? "ດາວ/ຈອງ" : "ງວດ " + addForm.nextInst.seq} · ກຳນົດ ${addForm.nextInst.due_date ? fdate(addForm.nextInst.due_date) : "—"}`
                  : "ຈ່າຍຄົບທຸກງວດແລ້ວ (ບັນທຶກເປັນຈ່າຍນອກງວດ)"} />
            </Field>
            <Field label="ຈຳນວນເງິນ *">
              <MoneyInput required value={addForm.amount_received} onChange={(v) => setAddForm({ ...addForm, amount_received: v })} />
            </Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={addForm.currency} onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ວັນທີຮັບເງິນ *"><input className="inp" type="date" required value={addForm.pay_date} onChange={(e) => setAddForm({ ...addForm, pay_date: e.target.value })} /></Field>
            <Field label="ຊ່ອງທາງ">
              <select className="inp" value={addForm.channel} onChange={(e) => setAddForm({ ...addForm, channel: e.target.value })}>
                <option>ເງິນສົດ</option><option>ໂອນ BCEL</option><option>ໂອນ LDB</option><option>ໂອນທະນາຄານອື່ນ</option>
              </select>
            </Field>
            <div className="col-span-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800">
              ເລກໃບຮັບເງິນອອກອັດຕະໂນມັດ (R-2026-XXXX) · ບັນທຶກແລ້ວກົດ 🖨 ຫຼື 📄 ໃນ tab ການຮັບເງິນ ເພື່ອສົ່ງໃຫ້ລູກຄ້າ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກການຊຳລະ</button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!form} title="💰 ບັນທຶກຮັບເງິນ" onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={receive} className="grid grid-cols-2 gap-3">
            <div className="col-span-2 text-sm text-slate-500">{form.label}</div>
            <Field label="ຈຳນວນຕາມກຳນົດ"><input className="inp bg-slate-50" disabled value={Number(form.amount_due).toLocaleString()} /></Field>
            <Field label="ຈຳນວນຮັບຕົວຈິງ (ຄີແກ້ໄຂໄດ້) *">
              <MoneyInput required value={form.amount_received} onChange={(v) => setForm({ ...form, amount_received: v })} />
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
            <Field label="ເລກໃບຮັບເງິນ"><input className="inp bg-slate-50" disabled value="ອອກອັດຕະໂນມັດ (R-2026-XXXX)" /></Field>
            <div className="col-span-2 text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800">
              ຮັບໜ້ອຍກວ່າກຳນົດ = ຍອດຄ້າງຍັງຄົງຄ້າງໃນງວດນີ້ · ບັນທຶກແລ້ວກົດ 🖨 ໃບມອບຮັບເງິນ ໃນ tab ການຮັບເງິນ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກຮັບເງິນ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Payments /></Shell>; }
