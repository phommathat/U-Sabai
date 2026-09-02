"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table, Pager, usePager } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, PAY_TYPE, CONTRACT_STATUS, buildInstallments } from "@/lib/fmt";

const ST_COLOR = { booking: "amber", paying: "blue", overdue: "red", completed: "green", cancelled: "gray" };
const num = (v) => (v === "" || v == null ? null : v);

function Contracts() {
  const { projectId, projectIds, project, profile } = useApp();
  const [rows, setRows] = useState([]);
  const [bal, setBal] = useState({});
  const [lots, setLots] = useState([]);
  const [custs, setCusts] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => {
    if (!projectIds.length) return;
    supabase.from("contracts")
      .select("*, lots(code), customers(code,full_name)")
      .in("project_id", projectIds).order("created_at", { ascending: false }).limit(2000)
      .then(({ data }) => setRows(data || []));
    supabase.from("v_contract_balance").select("*").in("project_id", projectIds)
      .then(({ data }) => setBal(Object.fromEntries((data || []).map((b) => [b.id, b]))));
    if (projectId)
      supabase.from("lots").select("id,code,list_price,currency").eq("project_id", projectId)
        .in("status", ["available", "reserved"]).order("code").then(({ data }) => setLots(data || []));
    supabase.from("customers").select("id,code,full_name,tel,village,occupation").order("code").limit(2000)
      .then(({ data }) => setCusts(data || []));
  };
  useEffect(() => { load(); }, [projectIds]);

  // ມາຈາກຜັງຕອນດິນ (?lot=...) → ເປີດຟອມພ້ອມຕອນ + ລາຄາທີ່ດຶງມາແລ້ວ
  useEffect(() => {
    const lotId = new URLSearchParams(window.location.search).get("lot");
    if (lotId && lots.length) {
      const l = lots.find((x) => x.id === lotId);
      setForm({
        pay_type: "installment", currency: l?.currency || "LAK",
        sign_date: new Date().toISOString().slice(0, 10), installment_period_months: 1,
        status: "paying", balance_due_when: "after_deed_transfer", mode: "new",
        lot_id: lotId, list_price: l?.list_price, sale_price: l?.list_price,
      });
      window.history.replaceState({}, "", "/contracts");
    }
  }, [lots]);

  const pickLot = (id) => {
    const l = lots.find((x) => x.id === id);
    setForm({ ...form, lot_id: id, list_price: l?.list_price, sale_price: l?.list_price, currency: l?.currency || "LAK" });
  };

  // ເລືອກລູກຄ້າເກົ່າ → ດຶງ ເບີໂທ/ທີ່ຢູ່/ອາຊີບ ມາເຕີມໃຫ້ແກ້ຕໍ່ໄດ້
  const pickCust = (id) => {
    const c = custs.find((x) => x.id === id);
    setForm({ ...form, customer_id: id, cust_tel: c?.tel || "", cust_village: c?.village || "", cust_occupation: c?.occupation || "" });
  };

  const save = async (e) => {
    e.preventDefault();
    // 1) ລູກຄ້າ: ໃໝ່ = ສ້າງພ້ອມລະຫັດ auto · ເກົ່າ = ອັບເດດຂໍ້ມູນຕິດຕໍ່
    const custData = { tel: form.cust_tel || null, village: form.cust_village || null, occupation: form.cust_occupation || null };
    let customerId = form.customer_id;
    if (form.mode !== "old") {
      const { data: code, error: e0 } = await supabase.rpc("next_customer_code");
      if (e0) return alert("ອອກລະຫັດລູກຄ້າບໍ່ໄດ້: " + e0.message);
      const full_name = [form.first_name, form.last_name].filter(Boolean).join(" ");
      const { data: cu, error: e1 } = await supabase.from("customers")
        .insert({ code, first_name: form.first_name, last_name: form.last_name || null, full_name, ...custData })
        .select("id").single();
      if (e1) return alert("ບັນທຶກລູກຄ້າຜິດພາດ: " + e1.message);
      customerId = cu.id;
    } else {
      if (!customerId) return alert("ກະລຸນາເລືອກລູກຄ້າ");
      await supabase.from("customers").update(custData).eq("id", customerId);
    }
    // 2) ອອກເລກສັນຍາ ຕາມກົດ ໂຄງການ-ປີ-ຕອນ  ເຊັ່ນ P04-26-B1
    //    (ຖ້າຕອນນີ້ເຄີຍມີສັນຍາແລ້ວ — ເຊັ່ນ ຍົກເລີກແລ້ວຂາຍໃໝ່ — ຕໍ່ທ້າຍ -2, -3 …)
    let contractNo = null;
    const lotCode = lots.find((x) => x.id === form.lot_id)?.code;
    if (project?.code && lotCode) {
      const yy = String(new Date(form.sign_date).getFullYear()).slice(2);
      const base = `${project.code}-${yy}-${lotCode}`;
      const { data: dup } = await supabase.from("contracts").select("contract_no").like("contract_no", `${base}%`);
      const taken = new Set((dup || []).map((d) => d.contract_no));
      contractNo = base;
      for (let i = 2; taken.has(contractNo); i++) contractNo = `${base}-${i}`;
    } else {
      // ສຳຮອງ: ບໍ່ຮູ້ລະຫັດໂຄງການ/ຕອນ → ໃຊ້ເລກລຳດັບເອກະສານ 2026-XXX
      const { data: no, error: numErr } = await supabase.rpc("next_doc_no", { p_doc_type: "contract" });
      if (numErr) return alert("ອອກເລກສັນຍາບໍ່ໄດ້: " + numErr.message);
      contractNo = no;
    }
    // 3) ບັນທຶກສັນຍາ — ພະນັກງານຂາຍດຶງ auto ຈາກ account ທີ່ login
    const c = {
      contract_no: contractNo, project_id: projectId, lot_id: form.lot_id, customer_id: customerId,
      sign_date: form.sign_date, pay_type: form.pay_type,
      list_price: num(form.list_price), discount: form.discount || 0, sale_price: num(form.sale_price),
      currency: form.currency, booking_fee: form.booking_fee || 0, down_payment: form.down_payment || 0,
      n_deeds: num(form.n_deeds) || 1, pay_other: form.pay_other || null,
      n_installments: num(form.n_installments), installment_period_months: form.installment_period_months || 1,
      installment_amt: num(form.installment_amt), first_due_date: num(form.first_due_date),
      cash_pay1: num(form.cash_pay1), cash_pay2: num(form.cash_pay2),
      balance_due_when: form.balance_due_when, status: form.status,
      sales_person: profile?.full_name || null,
      created_by: profile?.id || null, // ຜູ້ໃຊ້ລະບົບທີ່ອອກສັນຍາ — ໃຊ້ເປັນ "ຜູ້ຂາຍ" ຕອນປຣິນ + ກວດຄືນ
    };
    const { data, error } = await supabase.from("contracts").insert(c).select().single();
    if (error) return alert("ຜິດພາດ: " + error.message);
    const inst = buildInstallments(c).map((r) => ({ ...r, contract_id: data.id }));
    let instRows = [];
    if (inst.length) {
      const { data: ins } = await supabase.from("installments").insert(inst).select("id,seq");
      instRows = ins || [];
    }
    // 4) ເງິນທີ່ຮັບແລ້ວມື້ເຮັດສັນຍາ → ບັນທຶກເປັນ payment ອັດຕະໂນມັດ (ນັບເຂົ້າເກນ 20% ແລະ ຍອດຊຳລະແລ້ວ)
    //    4.1 ເງິນມື້ຈອງ/ມັດຈຳ · 4.2 ເງິນດາວ (ງວດ 0) — ຜູກ installment_id ໃຫ້ ງວດ 0 ຂຶ້ນ "ຮັບແລ້ວ"
    const autoPays = [];
    if (Number(form.booking_fee) > 0)
      autoPays.push({
        contract_id: data.id, installment_id: null, pay_date: c.sign_date,
        amount_received: form.booking_fee, currency: c.currency, channel: "ເງິນສົດ",
        note: "ເງິນມັດຈຳມື້ຈອງ (ບັນທຶກ auto ຈາກຟອມສັນຍາ)", created_by: profile?.id || null,
      });
    if (c.pay_type === "installment" && Number(form.down_payment) > 0 && form.down_received !== false)
      autoPays.push({
        contract_id: data.id,
        installment_id: instRows.find((r) => r.seq === 0)?.id || null,
        pay_date: c.sign_date, amount_received: form.down_payment,
        currency: c.currency, channel: "ເງິນສົດ",
        // ຄຳວ່າ "ຈ່າຍກ່ອນ" ຈຳເປັນ — ໜ້າ "ການຊຳລະ" ໃຊ້ແຍກເງິນດາວອອກຈາກເງິນຄ່າງວດ
        note: "ຈ່າຍກ່ອນ — ເງິນດາວມື້ເຮັດສັນຍາ (ບັນທຶກ auto ຈາກຟອມສັນຍາ)",
        created_by: profile?.id || null,
      });
    for (const pay of autoPays) {
      const { data: rno } = await supabase.rpc("next_receipt_no");
      await supabase.from("payments").insert({ ...pay, receipt_no: rno || null });
    }
    await supabase.from("lots").update({ status: "sold" }).eq("id", c.lot_id);
    setForm(null); load();
    alert(`ບັນທຶກສັນຍາ ${contractNo} ສຳເລັດ — ສ້າງ ${inst.length} ງວດອັດຕະໂນມັດ`);
  };

  const pg = usePager(rows, [projectIds]); // 50 ສັນຍາ/ໜ້າ

  const isInst = form?.pay_type === "installment";
  const isCash = form?.pay_type === "cash";
  const isNew = form?.mode !== "old";

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-navy">ສັນຍາຂາຍ ({rows.length})</h2>
        <button className="btn-p" onClick={() => projectId
          ? setForm({ pay_type: "installment", currency: "LAK", sign_date: new Date().toISOString().slice(0, 10), installment_period_months: 1, status: "paying", balance_due_when: "after_deed_transfer", mode: "new" })
          : alert("ກະລຸນາເລືອກໂຄງການດຽວກ່ອນ ຈຶ່ງສ້າງສັນຍາໄດ້")}>
          + ສ້າງສັນຍາໃໝ່
        </button>
      </div>
      <Table cols={["ເລກສັນຍາ", "ລູກຄ້າ", "ຕອນ", "ປະເພດ", "ມູນຄ່າ", "ຊຳລະແລ້ວ", "ຍອດຄ້າງ", "%", "ຜູ້ອອກສັນຍາ", "ສະຖານະ", ""]}
        rows={pg.rows.map((c) => {
          const b = bal[c.id] || {};
          const done = (b.pct_paid || 0) >= 100;
          return [
            <b key="n">{c.contract_no}</b>, c.customers?.full_name, c.lots?.code,
            <Badge key="t" color="navy">{PAY_TYPE[c.pay_type]}</Badge>,
            fmt(c.sale_price, c.currency), fmt(b.total_paid, c.currency),
            done ? <span key="b" className="text-brand-green text-xs font-semibold">ຄົບແລ້ວ ✓</span>
                 : <b key="b" className="text-brand-red">{fmt(b.balance, c.currency)}</b>,
            <div key="p" className="w-24">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-green" style={{ width: `${Math.min(b.pct_paid || 0, 100)}%` }} />
              </div>
              <div className="text-[10px] text-slate-400">{b.pct_paid || 0}%{b.deed_eligible && " · ✓ ເກນ 20%"}</div>
            </div>,
            <span key="sp" className="text-xs">{c.sales_person || "—"}</span>,
            <Badge key="s" color={ST_COLOR[c.status]}>{CONTRACT_STATUS[c.status]}</Badge>,
            <a key="pr" className="btn-o !py-1 !px-2 text-xs" href={`/print/contract/${c.id}`} target="_blank">🖨</a>,
          ];
        })} />
      <Pager pg={pg} unit="ສັນຍາ" />

      <Modal open={!!form} title="ສ້າງສັນຍາໃໝ່" onClose={() => setForm(null)} wide>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ເລກສັນຍາ"><input className="inp bg-slate-50" disabled value="ອອກອັດຕະໂນມັດ (2026-XXX)" /></Field>
            <Field label="ວັນທີເຊັນ *"><input className="inp" type="date" required value={form.sign_date} onChange={(e) => setForm({ ...form, sign_date: e.target.value })} /></Field>
            <Field label="ຕອນດິນ *">
              <select className="inp" required value={form.lot_id || ""} onChange={(e) => pickLot(e.target.value)}>
                <option value="">— ເລືອກ —</option>
                {lots.map((l) => <option key={l.id} value={l.id}>{l.code} — {fmt(l.list_price, l.currency)}</option>)}
              </select>
            </Field>
            <Field label="ລູກຄ້າ">
              <div className="flex gap-3 items-center h-full text-sm">
                <label className="flex items-center gap-1"><input type="radio" checked={isNew} onChange={() => setForm({ ...form, mode: "new", customer_id: null })} /> ລູກຄ້າໃໝ່</label>
                <label className="flex items-center gap-1"><input type="radio" checked={!isNew} onChange={() => setForm({ ...form, mode: "old" })} /> ລູກຄ້າເກົ່າ/ມາຈາກໃບສັນຍາມັດຈຳ</label>
              </div>
            </Field>
            {isNew ? (<>
              <Field label="ຊື່ *"><input className="inp" required value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
              <Field label="ນາມສະກຸນ"><input className="inp" value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            </>) : (
              <Field label="ເລືອກລູກຄ້າ *">
                <select className="inp" required value={form.customer_id || ""} onChange={(e) => pickCust(e.target.value)}>
                  <option value="">— ເລືອກ —</option>
                  {custs.map((c) => <option key={c.id} value={c.id}>{c.code} {c.full_name}</option>)}
                </select>
              </Field>
            )}
            <Field label="ເບີໂທ"><input className="inp" value={form.cust_tel || ""} onChange={(e) => setForm({ ...form, cust_tel: e.target.value })} /></Field>
            <Field label="ທີ່ຢູ່ (ບ້ານ/ເມືອງ)"><input className="inp" value={form.cust_village || ""} onChange={(e) => setForm({ ...form, cust_village: e.target.value })} /></Field>
            <Field label="ອາຊີບ"><input className="inp" value={form.cust_occupation || ""} onChange={(e) => setForm({ ...form, cust_occupation: e.target.value })} /></Field>
            <Field label="ລາຄາຕັ້ງ"><input className="inp" type="number" value={form.list_price || ""} onChange={(e) => setForm({ ...form, list_price: e.target.value })} /></Field>
            <Field label="ສ່ວນຫຼຸດ"><input className="inp" type="number" value={form.discount || ""} onChange={(e) => setForm({ ...form, discount: e.target.value, sale_price: (form.list_price || 0) - (e.target.value || 0) })} /></Field>
            <Field label="ລາຄາຂາຍຕົວຈິງ (ຄີໄດ້) *"><input className="inp font-bold" type="number" required value={form.sale_price || ""} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
            <Field label="ສະກຸນເງິນ">
              <select className="inp" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option>LAK</option><option>THB</option><option>USD</option>
              </select>
            </Field>
            <Field label="ເງິນມື້ຈອງ (ຖ້າມີ — ຄີສະເພາະທີ່ຮັບແລ້ວ)"><input className="inp" type="number" value={form.booking_fee || ""} onChange={(e) => setForm({ ...form, booking_fee: e.target.value })} /></Field>
            <Field label="ຈຳນວນໃບຕາດິນ (ຕອນ)"><input className="inp" type="number" value={form.n_deeds ?? ""} placeholder="1" onChange={(e) => setForm({ ...form, n_deeds: e.target.value })} /></Field>
            <Field label="ປະເພດການຊຳລະ *">
              <select className="inp" value={form.pay_type} onChange={(e) => setForm({ ...form, pay_type: e.target.value })}>
                <option value="installment">ຜ່ອນເປັນງວດ</option>
                <option value="cash">ຈ່າຍສົດ (ກຳນົດງວດເອງ)</option>
                <option value="bank">ຜ່ານທະນາຄານ</option>
                <option value="other">ຮູບແບບອື່ນ</option>
              </select>
            </Field>
            {!isInst && !isCash && (
              <Field label="ລາຍລະອຽດການຈ່າຍ (ຮູບແບບອື່ນ)"><input className="inp" value={form.pay_other || ""} placeholder="ເຊັ່ນ: ໂອນຜ່ານ BCEL One 2 ງວດ..." onChange={(e) => setForm({ ...form, pay_other: e.target.value })} /></Field>
            )}
            {isInst && (<>
              <Field label="ເງິນມື້ເຮັດສັນຍາ (ເງິນດາວ)">
                <input className="inp" type="number" value={form.down_payment || ""} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} />
                <label className="flex items-center gap-1 text-xs mt-1">
                  <input type="checkbox" checked={form.down_received !== false}
                    onChange={(e) => setForm({ ...form, down_received: e.target.checked })} />
                  ຮັບເງິນນີ້ແລ້ວ — ບັນທຶກເປັນລາຍການຮັບເງິນ ວັນທີເຮັດສັນຍາ
                </label>
              </Field>
              <Field label="ຈຳນວນງວດ *"><input className="inp" type="number" required value={form.n_installments || ""} onChange={(e) => setForm({ ...form, n_installments: e.target.value })} /></Field>
              <Field label="ຄາບການຈ່າຍ">
                <select className="inp" value={form.installment_period_months} onChange={(e) => setForm({ ...form, installment_period_months: e.target.value })}>
                  <option value="1">ທຸກ 1 ເດືອນ</option><option value="3">ທຸກ 3 ເດືອນ</option><option value="6">ທຸກ 6 ເດືອນ</option>
                </select>
              </Field>
              <Field label="ເງິນຕໍ່ງວດ *"><input className="inp" type="number" required value={form.installment_amt || ""} onChange={(e) => setForm({ ...form, installment_amt: e.target.value })} /></Field>
              <Field label="ວັນນັດຈ່າຍງວດທຳອິດ * (ວັນທີໃນເດືອນ = ວັນນັດປະຈຳທຸກເດືອນ)"><input className="inp" type="date" required value={form.first_due_date || ""} onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} /></Field>
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
            <Field label="ພະນັກງານຂາຍ (auto ຈາກ account)"><input className="inp bg-slate-50" disabled value={profile?.full_name || "—"} /></Field>
            <div className="col-span-2 text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800">
              ບັນທຶກແລ້ວ: ຕອນດິນລັອກເປັນ "ຂາຍແລ້ວ" + ສ້າງຕາຕະລາງງວດອັດຕະໂນມັດ · ເງິນມື້ຈອງທີ່ຄີ ຈະບັນທຶກເປັນການຮັບເງິນອັດຕະໂນມັດ (ນັບເຂົ້າເກນ 20%) · ເງິນມື້ເຮັດສັນຍາ = ງວດ 0 ໃຫ້ໄປກົດ "ຮັບເງິນ" ໃນໜ້າຊຳລະເງິນ
            </div>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກສັນຍາ</button></div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Contracts /></Shell>; }
