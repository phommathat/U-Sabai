"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table, Pager, usePager } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, DEED_STAGE } from "@/lib/fmt";

function Customers() {
  const { projectIds } = useApp();
  const [rows, setRows] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [bal, setBal] = useState({});
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [drill, setDrill] = useState(null);   // ສັນຍາທີ່ເປີດເບິ່ງປະຫວັດຈ່າຍ
  const [dInst, setDInst] = useState([]);
  const [dPays, setDPays] = useState([]);

  const load = () => {
    supabase.from("customers").select("*").order("code").limit(2000)
      .then(({ data }) => setRows(data || []));
    // ໂຫຼດສັນຍາທຸກໂຄງການ ແລ້ວ filter ຕາມໂຄງການທີ່ເລືອກຕອນສະແດງຜົນ
    supabase.from("contracts")
      .select("id,contract_no,sign_date,customer_id,project_id,currency,sale_price, lots(code), projects(code,name), title_deeds(stage)")
      .neq("status", "cancelled").limit(3000)
      .then(({ data }) => setContracts(data || []));
    supabase.from("v_contract_balance").select("id,total_paid,balance,pct_paid").limit(3000)
      .then(({ data }) => setBal(Object.fromEntries((data || []).map((b) => [b.id, b]))));
  };
  useEffect(() => { load(); }, []);

  // ສັນຍາທັງໝົດຂອງແຕ່ລະລູກຄ້າ + ສະເພາະໂຄງການທີ່ເລືອກ
  const byCustAll = {};
  contracts.forEach((c) => (byCustAll[c.customer_id] = byCustAll[c.customer_id] || []).push(c));
  const byCust = {};
  Object.entries(byCustAll).forEach(([k, cs]) => {
    byCust[k] = cs.filter((c) => projectIds.includes(c.project_id));
  });

  const save = async (e) => {
    e.preventDefault();
    let error;
    if (form.id) {
      const { contracts: _c, ...f } = form;
      ({ error } = await supabase.from("customers").update(f).eq("id", form.id));
    } else {
      // ອອກລະຫັດອັດຕະໂນມັດ C00001 (ຕໍ່ຈາກລ່າສຸດ, atomic ກັນເລກຊ້ຳ)
      const { data: code, error: numErr } = await supabase.rpc("next_customer_code");
      if (numErr) return alert("ອອກລະຫັດລູກຄ້າບໍ່ໄດ້: " + numErr.message);
      ({ error } = await supabase.from("customers").insert({ ...form, code }));
    }
    if (error) alert("ຜິດພາດ: " + error.message);
    else { setForm(null); load(); }
  };

  // ---- drill-down: ປະຫວັດການຈ່າຍຂອງສັນຍາ (ຄືເມນູການຊຳລະ) ----
  const openDrill = async (c) => {
    setDrill(c); setDInst([]); setDPays([]);
    const [{ data: ins }, { data: pays }] = await Promise.all([
      supabase.from("installments").select("*, payments(id, amount_received)")
        .eq("contract_id", c.id).order("seq"),
      supabase.from("payments")
        .select("id,receipt_no,pay_date,amount_received,currency,channel,note,installment_id,created_at")
        .eq("contract_id", c.id).neq("pay_date", "1900-01-01")
        .order("pay_date", { ascending: false }),
    ]);
    setDInst(ins || []); setDPays(pays || []);
  };

  const today = new Date().toISOString().slice(0, 10);
  const paidOf = (i) => (i.payments || []).reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const instMap = Object.fromEntries(dInst.map((i) => [i.id, i]));
  // ຍອດຄ້າງຫຼັງແຕ່ລະການຈ່າຍ (ສະສົມ)
  const remainAfter = {};
  {
    let cum = 0;
    [...dPays].sort((a, b) => (a.pay_date + a.created_at).localeCompare(b.pay_date + b.created_at))
      .forEach((p) => { cum += Number(p.amount_received || 0); remainAfter[p.id] = Number(drill?.sale_price || 0) - cum; });
  }
  const punctual = (p) => {
    const due = p.installment_id ? instMap[p.installment_id]?.due_date : null;
    if (!due) return p.note || "—";
    const days = Math.round((new Date(p.pay_date) - new Date(due)) / 86400000);
    return days <= 0
      ? <span className="text-brand-green">ຈ່າຍຕາມກຳນົດ ✓</span>
      : <span className="text-brand-red">ກາຍກຳນົດ {days} ວັນ</span>;
  };
  // ---- ຈັດສັນຍອດແບບສະສົມ (FIFO): ຈ່າຍບໍ່ເຕັມ ≠ ຄ້າງ · ຈ່າຍລ່ວງໜ້າຄວບງວດທັດໄປ ----
  const isDown = (p) => (p.note || "").includes("ຈ່າຍກ່ອນ");
  const dDown = dPays.filter(isDown).reduce((s, p) => s + Number(p.amount_received || 0), 0);
  const fifo = (() => {
    let pool = dPays.filter((p) => !isDown(p)).reduce((s, p) => s + Number(p.amount_received || 0), 0);
    let down = dDown;
    const cov = {};
    [...dInst].sort((a, b) => a.seq - b.seq).forEach((i) => {
      const due = Number(i.amount_due || 0);
      const c = i.seq === 0 ? Math.min(down, due) : Math.min(pool, due);
      if (i.seq === 0) down -= c; else pool -= c;
      cov[i.id] = c;
    });
    return cov;
  })();
  const stKey = (i) => {
    const due = Number(i.amount_due || 0), c = fifo[i.id] || 0;
    return due <= 0 || c >= due ? "paid"
      : i.due_date && i.due_date < today ? (c > 0 ? "partial" : "overdue")
      : i.due_condition === "after_deed_transfer" ? "deed" : "due";
  };
  const stOf = (i) => ({
    paid: <Badge color="green">ຈ່າຍແລ້ວ</Badge>, overdue: <Badge color="red">ຄ້າງຊຳລະ</Badge>,
    partial: <Badge color="amber">ຈ່າຍບາງສ່ວນ</Badge>, deed: <Badge color="navy">ຈ່າຍຫຼັງໂອນໃບຕາດິນ</Badge>,
    due: <Badge color="gray">ຍັງບໍ່ຮອດກຳນົດ</Badge>,
  }[stKey(i)]);
  const dPaid = dPays.reduce((s, p) => s + Number(p.amount_received || 0), 0);

  const list = rows.filter((r) => {
    // filter ຕາມໂຄງການທີ່ເລືອກ: ລູກຄ້າທີ່ມີສັນຍາ ຕ້ອງມີສັນຍາໃນໂຄງການທີ່ເລືອກ
    // (ລູກຄ້າທີ່ຍັງບໍ່ມີສັນຍາເລີຍ ສະແດງທຸກກໍລະນີ ເພື່ອບໍ່ໃຫ້ລູກຄ້າໃໝ່ຫາຍ)
    const all = byCustAll[r.id] || [];
    if (all.length && !(byCust[r.id] || []).length) return false;
    if (!q) return true;
    const s = q.trim().toLowerCase();
    return r.full_name?.toLowerCase().includes(s) || r.tel?.includes(s) || r.code?.toLowerCase().includes(s)
      // ຄົ້ນຕາມຕອນດິນ (ລະຫັດຕອນ) ຫຼື ເລກສັນຍາ
      || (byCust[r.id] || []).some((ct) =>
        ct.lots?.code?.toLowerCase().includes(s) || ct.contract_no?.toLowerCase().includes(s));
  });

  // ---- pagination: 50 ຄົນ/ໜ້າ ----
  const pg = usePager(list, [q, projectIds]);

  return (
    <>
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <h2 className="text-lg font-bold text-navy">ລູກຄ້າ ({list.length})</h2>
        <input className="inp !w-64 ml-auto" placeholder="🔍 ຄົ້ນຫາ ຊື່/ເບີໂທ/ລະຫັດ/ຕອນດິນ..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-p" onClick={() => setForm({})}>+ ເພີ່ມລູກຄ້າ</button>
      </div>
      <Table cols={["ລະຫັດ", "ຊື່ ແລະ ນາມສະກຸນ", "ເບີໂທ", "ຊື້ໂຄງການ / ຕອນ", "ວັນເຮັດສັນຍາ", "ສະຖານະຈ່າຍ", "ໃບຕາດິນ", ""]}
        rows={pg.rows.map((c) => {
          const cs = byCust[c.id] || [];
          const cell = (fn) => cs.length
            ? <div key="x" className="space-y-1">{cs.map((ct) => <div key={ct.id}>{fn(ct)}</div>)}</div>
            : <span key="x" className="text-slate-300">—</span>;
          return [
            c.code,
            // click ຊື່ → ເບິ່ງປະຫວັດຈ່າຍ (ສັນຍາທຳອິດ ຖ້າມີຫຼາຍສັນຍາ click ຕອນທີ່ຕ້ອງການໃນຖັນຊື້ໂຄງການ/ຕອນ)
            cs.length
              ? <button key="n" className="font-bold text-navy underline decoration-dotted hover:text-brand-amber text-left"
                  onClick={() => openDrill({ ...cs[0], customer: c })}>{c.full_name}</button>
              : <b key="n">{c.full_name}</b>,
            c.tel || "—",
            // click ຕອນ → ເບິ່ງປະຫວັດຈ່າຍ
            cell((ct) => (
              <button className="text-navy underline decoration-dotted hover:text-brand-amber"
                onClick={() => openDrill({ ...ct, customer: c })}>
                {ct.projects?.code} · ຕອນ {ct.lots?.code}
              </button>
            )),
            cell((ct) => fdate(ct.sign_date)),
            cell((ct) => {
              const b = bal[ct.id] || {};
              return (b.pct_paid || 0) >= 100
                ? <span className="text-brand-green font-semibold">ຄົບ 100% ✓</span>
                : <span>{b.pct_paid || 0}% · ຄ້າງ <b className="text-brand-red">{fmt(b.balance, ct.currency)}</b></span>;
            }),
            cell((ct) => {
              const st = ct.title_deeds?.stage;
              return st
                ? <Badge color={st === "handed_over" ? "green" : "blue"}>{DEED_STAGE[st]}</Badge>
                : <Badge color="gray">ຍັງບໍ່ເລີ່ມ</Badge>;
            }),
            <button key="e" className="btn-o !py-1 !px-3 text-xs" onClick={() => setForm(c)}>ແກ້ໄຂ</button>,
          ];
        })} />

      {/* ---- ໜ້າ: 50 ຄົນ/ໜ້າ ---- */}
      <Pager pg={pg} unit="ຄົນ" />

      {/* ---- ປະຫວັດການຈ່າຍ (ຄືເມນູການຊຳລະ) ---- */}
      <Modal open={!!drill} title={drill ? `${drill.customer?.full_name} — ${drill.projects?.name} · ຕອນ ${drill.lots?.code}` : ""} onClose={() => setDrill(null)} wide>
        {drill && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div>ເລກສັນຍາ: <b>{drill.contract_no}</b> ({fdate(drill.sign_date)})</div>
              <div>ມູນຄ່າສັນຍາ: <b>{fmt(drill.sale_price, drill.currency)}</b></div>
              <div>ເງິນດາວ: <b className="text-navy">{fmt(dDown || null, drill.currency)}</b></div>
              <div>ຊຳລະແລ້ວ: <b className="text-brand-green">{fmt(dPaid, drill.currency)}</b></div>
              <div>ຍອດຄ້າງ: <b className="text-brand-red">{fmt(Math.max(Number(drill.sale_price) - dPaid, 0), drill.currency)}</b></div>
            </div>
            <div>
              <div className="font-semibold text-navy mb-1">ການຮັບເງິນ ({dPays.length})</div>
              <Table cols={["ວັນທີຈ່າຍ", "ງວດ", "ວັນກຳນົດຈ່າຍ", "ຈຳນວນ", "ຍອດຄ້າງຫຼັງຈ່າຍ", "ໝາຍເຫດ", ""]}
                empty="ຍັງບໍ່ມີການຮັບເງິນ"
                rows={dPays.map((p) => {
                  const li = p.installment_id ? instMap[p.installment_id] : null;
                  return [
                    fdate(p.pay_date),
                    isDown(p) ? "ດາວ (ງວດ 0)" : li ? `ງວດ ${li.seq}` : (p.note?.match(/ງວດ\s*\d+[^·]*/)?.[0]?.trim() || "—"),
                    li?.due_date ? fdate(li.due_date) : "—",
                    <b key="a">{fmt(p.amount_received, p.currency)}</b>,
                    remainAfter[p.id] > 0 ? fmt(remainAfter[p.id], drill.currency) : "ຄົບແລ້ວ ✓",
                    punctual(p),
                    <span key="pr" className="flex gap-1">
                      <a className="btn-o !py-0.5 !px-2 text-xs" title="ພິມ" href={`/print/receipt/${p.id}`} target="_blank">🖨</a>
                      <a className="btn-o !py-0.5 !px-2 text-xs" title="ບັນທຶກ PDF" href={`/print/receipt/${p.id}?auto=1`} target="_blank">📄</a>
                    </span>,
                  ];
                })} />
            </div>
            <div>
              {(() => { const left = dInst.filter((i) => stKey(i) !== "paid"); return (<>
              <div className="font-semibold text-navy mb-1">ຕາຕະລາງງວດ — ຄ້າງ ແລະ ຕ້ອງຊຳລະຕໍ່ໄປ ({left.length})</div>
              <Table cols={["ງວດ", "ຄົບກຳນົດ", "ຕາມກຳນົດ", "ຮັບແລ້ວ", "ຄ້າງ", "ສະຖານະ"]}
                empty="✓ ຊຳລະຄົບທຸກງວດແລ້ວ"
                rows={left.map((i) => [
                  i.seq === 0 ? "ດາວ (ງວດ 0)" : `ງວດ ${i.seq}`,
                  i.due_date ? fdate(i.due_date) : (i.due_condition === "after_deed_transfer" ? "ຫຼັງໂອນໃບຕາດິນ" : "—"),
                  fmt(i.amount_due, drill.currency), fmt(fifo[i.id] || null, drill.currency),
                  Number(i.amount_due) > (fifo[i.id] || 0) ? <b key="o" className="text-brand-red">{fmt(Number(i.amount_due) - (fifo[i.id] || 0), drill.currency)}</b> : "—",
                  stOf(i),
                ])} />
              </>); })()}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!form} title={form?.id ? "ແກ້ໄຂລູກຄ້າ" : "ເພີ່ມລູກຄ້າ"} onClose={() => setForm(null)}>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ລະຫັດ">
              {form.id
                ? <input className="inp bg-slate-50" disabled value={form.code || ""} />
                : <input className="inp bg-slate-50" disabled value="ອອກອັດຕະໂນມັດ (C000XX)" />}
            </Field>
            <Field label="ຊື່ ແລະ ນາມສະກຸນ *"><input className="inp" required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="ຊື່"><input className="inp" value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
            <Field label="ນາມສະກຸນ"><input className="inp" value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            <Field label="ເບີໂທ"><input className="inp" value={form.tel || ""} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
            <Field label="ອາຍຸ"><input className="inp" type="number" value={form.age ?? ""} onChange={(e) => setForm({ ...form, age: e.target.value ? Number(e.target.value) : null })} /></Field>
            <Field label="ສັນຊາດ"><input className="inp" value={form.nationality ?? "ລາວ"} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></Field>
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
