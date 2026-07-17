"use client";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Field, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fdate } from "@/lib/fmt";

const CUR = [
  ["THB", "ບາດ ໄທ", "฿"],
  ["USD", "ໂດລາ ສະຫະລັດ", "$"],
];

const ROLES = [
  ["admin", "ຜູ້ຄຸ້ມຄອງລະບົບ"], ["ceo", "ຜູ້ບໍລິຫານ"], ["sales", "ຝ່າຍຂາຍ"],
  ["finance", "ຝ່າຍການເງິນ"], ["development", "ຝ່າຍພັດທະນາ"], ["marketing", "ຝ່າຍການຕະຫຼາດ"],
];
const RNAME = Object.fromEntries(ROLES);

const MENUS = [
  ["overview", "ພາບລວມ"], ["lots", "ຜັງຕອນດິນ"], ["customers", "ລູກຄ້າ"],
  ["bookings", "ການຈອງ"], ["contracts", "ສັນຍາຂາຍ"], ["payments", "ການຊຳລະເງິນ"],
  ["deeds", "ໃບຕາດິນ"], ["costs", "ສະຫຼຸບການລົງທຶນ"], ["documents", "ເອກະສານລູກຄ້າ"], ["settings", "ຕັ້ງຄ່າ"],
];

// ---------- ຈັດການໂຄງການ (admin/ceo) ----------
// ສະຖານະໂຄງການ
const PRJ_ST = [
  ["developing", "ກຳລັງພັດທະນາ"], ["selling", "ເປີດຂາຍ"],
  ["sold_out", "ຂາຍໝົດ"], ["closed", "ປິດໂຄງການ"],
];
const PRJ_NAME = Object.fromEntries(PRJ_ST);
const PRJ_COLOR = { developing: "amber", selling: "green", sold_out: "blue", closed: "gray" };

// map ຄຳລາວ ↔ ລະຫັດ ສະຖານະຕອນ ສຳລັບ import
const LOT_ST_IN = { "ຫວ່າງ": "available", "ຈອງ": "reserved", "ຂາຍແລ້ວ": "sold" };
// ຫົວຕາຕະລາງ template — ຝັງຊື່ອັງກິດໃນວົງເລັບ ໃຊ້ຈັບຄູ່ຄໍລຳຕອນອ່ານ
const LOT_COLS = [
  ["ລະຫັດຕອນ (lot_code) *", "A1"],
  ["ໂຊນ (zone)", "A"],
  ["ເນື້ອທີ່ຕລມ (size_sqm) *", 400],
  ["ກວ້າງແມັດ (width_m)", 20],
  ["ຍາວແມັດ (length_m)", 20],
  ["ລາຄາຕໍ່ຕລມ (price_per_sqm)", 1200],
  ["ລາຄາຕັ້ງ (list_price)", 480000],
  ["ສະກຸນ THB/LAK/USD (currency)", "THB"],
  ["ສະຖານະ ຫວ່າງ/ຈອງ/ຂາຍແລ້ວ (status)", "ຫວ່າງ"],
  ["ໃບຕາດິນແມ່ (parent_deed_no)", ""],
  ["ໝາຍເຫດ (note)", "ຕົວຢ່າງ — ລຶບແຖວນີ້ອອກ ກ່ອນ upload"],
];
const colVal = (row, en) => {
  const k = Object.keys(row).find((h) => h.includes(`(${en})`));
  return k != null ? row[k] : null;
};

function Projects() {
  const [projects, setProjects] = useState([]);
  const [counts, setCounts] = useState({});      // project_id → ຈຳນວນຕອນຕົວຈິງ
  const [form, setForm] = useState(null);        // ຟອມເພີ່ມ/ແກ້ໂຄງການ
  const [imp, setImp] = useState(null);          // { project, rows?, busy?, done? }

  const load = () => {
    supabase.from("projects").select("*").order("code").then(({ data }) => setProjects(data || []));
    supabase.from("lots").select("project_id").then(({ data }) => {
      const c = {};
      (data || []).forEach((l) => { c[l.project_id] = (c[l.project_id] || 0) + 1; });
      setCounts(c);
    });
  };
  useEffect(() => { load(); }, []);

  // ---- ບັນທຶກໂຄງການ ----
  const save = async (e) => {
    e.preventDefault();
    const row = {
      code: form.code?.trim(), name: form.name?.trim(),
      village: form.village || null, district: form.district || null, province: form.province || null,
      area_ha: form.area_ha === "" || form.area_ha == null ? null : Number(form.area_ha),
      total_lots: form.total_lots === "" || form.total_lots == null ? null : Number(form.total_lots),
      start_date: form.start_date || null, status: form.status || "developing", note: form.note || null,
    };
    const { error } = form.id
      ? await supabase.from("projects").update(row).eq("id", form.id)
      : await supabase.from("projects").insert(row);
    if (error) return alert("ຜິດພາດ: " + error.message);
    setForm(null); load();
  };

  // ---- ດາວໂຫຼດ template Excel ----
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      LOT_COLS.map(([h]) => h),
      LOT_COLS.map(([, ex]) => ex),
    ]);
    ws["!cols"] = LOT_COLS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ຕອນດິນ");
    XLSX.writeFile(wb, "USabai_Template_ຕອນດິນ.xlsx");
  };

  // ---- ອ່ານໄຟລ໌ upload → ແປງເປັນແຖວ lots ----
  const onFile = async (file, project) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sh = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sh, { defval: null });
      const rows = [];
      const errors = [];
      json.forEach((r, i) => {
        const code = colVal(r, "lot_code");
        const note = colVal(r, "note");
        if (code == null || String(code).trim() === "") return;                    // ຂ້າມແຖວຫວ່າງ
        if (typeof note === "string" && note.trim().startsWith("ຕົວຢ່າງ")) return;  // ຂ້າມແຖວຕົວຢ່າງ
        const size = colVal(r, "size_sqm");
        const pps = colVal(r, "price_per_sqm");
        const list = colVal(r, "list_price");
        const stRaw = colVal(r, "status");
        const st = LOT_ST_IN[String(stRaw || "").trim()]
          || (["available", "reserved", "sold"].includes(stRaw) ? stRaw : "available");
        if (size == null || size === "" || isNaN(Number(size)))
          errors.push(`ແຖວ ${i + 2} (ຕອນ ${code}): ບໍ່ມີເນື້ອທີ່`);
        rows.push({
          project_id: project.id,
          code: String(code).trim(),
          zone: colVal(r, "zone") || null,
          size_sqm: Number(size) || 0,
          width_m: colVal(r, "width_m") != null ? Number(colVal(r, "width_m")) : null,
          length_m: colVal(r, "length_m") != null ? Number(colVal(r, "length_m")) : null,
          price_per_sqm: pps != null && pps !== "" ? Number(pps) : null,
          list_price: list != null && list !== "" ? Number(list) : (Number(size) || 0) * (Number(pps) || 0),
          currency: String(colVal(r, "currency") || "THB").trim().toUpperCase(),
          status: st,
          parent_deed_no: colVal(r, "parent_deed_no") || null,
          note: typeof note === "string" ? note : null,
        });
      });
      setImp({ project, rows, errors });
    } catch (err) {
      alert("ອ່ານໄຟລ໌ບໍ່ໄດ້: " + err.message);
    }
  };

  // ---- ບັນທຶກ lots (upsert: ຕອນເກົ່າ=ອັບເດດ, ໃໝ່=ເພີ່ມ) ----
  const importSave = async () => {
    setImp((s) => ({ ...s, busy: true }));
    const { error } = await supabase.from("lots")
      .upsert(imp.rows, { onConflict: "project_id,code" });
    if (error) { setImp((s) => ({ ...s, busy: false })); return alert("ບັນທຶກຜິດພາດ: " + error.message); }
    setImp((s) => ({ ...s, busy: false, done: imp.rows.length }));
    load();
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-navy">ຈັດການໂຄງການ</h2>
        <button className="btn-p !py-1.5 text-sm" onClick={() => setForm({ status: "developing" })}>+ ເພີ່ມໂຄງການ</button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        ເພີ່ມໂຄງການໃໝ່ (ບ້ານ/ເມືອງ/ແຂວງ, ຈຳນວນຕອນ, ເນື້ອທີ່) ແລ້ວ import ຕອນດິນຈາກ Excel ໄດ້ເປັນຊຸດ.
        ການແກ້ເນື້ອທີ່/ເພີ່ມຕອນຮາຍຕົວ ເຮັດໄດ້ໃນໜ້າ ຜັງຕອນດິນ.
      </p>
      <Table cols={["ລະຫັດ", "ຊື່ໂຄງການ", "ທີ່ຕັ້ງ", "ຕອນ (ຕົວຈິງ/ວາງແຜນ)", "ເນື້ອທີ່ (ha)", "ສະຖານະ", ""]}
        rows={projects.map((p) => [
          <b key="c">{p.code}</b>,
          p.name,
          <span key="l" className="text-xs">{[p.village, p.district, p.province].filter(Boolean).join(", ") || "—"}</span>,
          <span key="n">{counts[p.id] || 0}{p.total_lots ? ` / ${p.total_lots}` : ""}</span>,
          p.area_ha ?? "—",
          <Badge key="s" color={PRJ_COLOR[p.status] || "gray"}>{PRJ_NAME[p.status] || p.status}</Badge>,
          <div key="a" className="flex gap-1.5 justify-end">
            <button className="btn-o !py-1 !px-2.5 text-xs" onClick={() => setForm(p)}>ແກ້ໄຂ</button>
            <button className="btn-o !py-1 !px-2.5 text-xs" onClick={() => setImp({ project: p })}>📥 import ຕອນ</button>
          </div>,
        ])} />

      {/* ຟອມ ເພີ່ມ/ແກ້ ໂຄງການ */}
      <Modal open={!!form} title={form?.id ? `✏️ ແກ້ໄຂໂຄງການ ${form.code}` : "➕ ເພີ່ມໂຄງການໃໝ່"} onClose={() => setForm(null)} wide>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ລະຫັດໂຄງການ * (ເຊັ່ນ P05)"><input className="inp" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="ຊື່ໂຄງການ *"><input className="inp" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="ບ້ານ"><input className="inp" value={form.village || ""} onChange={(e) => setForm({ ...form, village: e.target.value })} /></Field>
            <Field label="ເມືອງ"><input className="inp" value={form.district || ""} onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
            <Field label="ແຂວງ"><input className="inp" value={form.province || ""} onChange={(e) => setForm({ ...form, province: e.target.value })} /></Field>
            <Field label="ເນື້ອທີ່ລວມ (ເຮັກຕາ)"><input className="inp" type="number" step="0.01" value={form.area_ha ?? ""} onChange={(e) => setForm({ ...form, area_ha: e.target.value })} /></Field>
            <Field label="ຈຳນວນຕອນ (ວາງແຜນ)"><input className="inp" type="number" value={form.total_lots ?? ""} onChange={(e) => setForm({ ...form, total_lots: e.target.value })} /></Field>
            <Field label="ວັນທີເລີ່ມໂຄງການ"><input className="inp" type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="ສະຖານະ">
              <select className="inp" value={form.status || "developing"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {PRJ_ST.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="ໝາຍເຫດ"><input className="inp" value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>

      {/* import ຕອນດິນ ຈາກ Excel */}
      <Modal open={!!imp} title={`📥 import ຕອນດິນ — ${imp?.project?.code || ""}`} onClose={() => setImp(null)} wide>
        {imp && (imp.done != null ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-4xl">✅</div>
            <div className="font-semibold text-navy">ບັນທຶກ {imp.done} ຕອນ ສຳເລັດ</div>
            <button className="btn-p" onClick={() => setImp(null)}>ປິດ</button>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <ol className="list-decimal ml-5 space-y-1 text-slate-600">
              <li>ດາວໂຫຼດ template → ຕື່ມຂໍ້ມູນຕອນດິນ (ລຶບແຖວຕົວຢ່າງອອກ)</li>
              <li>ອັບໂຫຼດໄຟລ໌ທີ່ຕື່ມແລ້ວ → ກວດ → ບັນທຶກ</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-o" onClick={downloadTemplate}>⬇️ ດາວໂຫຼດ template</button>
              <label className="btn-o cursor-pointer">
                📁 ເລືອກໄຟລ໌ Excel
                <input type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => e.target.files[0] && onFile(e.target.files[0], imp.project)} />
              </label>
            </div>

            {imp.rows && (
              <div className="border-t pt-3 space-y-2">
                <div className="font-semibold text-navy">ພົບ {imp.rows.length} ຕອນ ໃນໄຟລ໌</div>
                {imp.errors?.length > 0 && (
                  <div className="bg-red-50 text-red-600 rounded-lg p-2 text-xs space-y-0.5">
                    {imp.errors.slice(0, 8).map((er, i) => <div key={i}>⚠️ {er}</div>)}
                    {imp.errors.length > 8 && <div>...ແລະ ອີກ {imp.errors.length - 8} ແຖວ</div>}
                  </div>
                )}
                <div className="max-h-52 overflow-y-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0"><tr>
                      <th className="th !py-1.5">ຕອນ</th><th className="th !py-1.5">ໂຊນ</th>
                      <th className="th !py-1.5">ຕລມ</th><th className="th !py-1.5">ລາຄາຕັ້ງ</th>
                      <th className="th !py-1.5">ສະກຸນ</th><th className="th !py-1.5">ສະຖານະ</th>
                    </tr></thead>
                    <tbody>
                      {imp.rows.slice(0, 40).map((r, i) => (
                        <tr key={i} className="border-t"><td className="td !py-1">{r.code}</td>
                          <td className="td !py-1">{r.zone || "—"}</td><td className="td !py-1">{r.size_sqm}</td>
                          <td className="td !py-1">{Number(r.list_price).toLocaleString("en-US")}</td>
                          <td className="td !py-1">{r.currency}</td>
                          <td className="td !py-1">{LOT_STATUS_LAO[r.status]}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {imp.rows.length > 40 && <div className="text-xs text-slate-400">ສະແດງ 40 ແຖວທຳອິດ — ບັນທຶກທັງໝົດ {imp.rows.length} ຕອນ</div>}
                <p className="text-[11px] text-slate-400">ຕອນທີ່ລະຫັດຊ້ຳກັບຂອງເກົ່າ ຈະຖືກ <b>ອັບເດດ</b> (ໃຊ້ແກ້ເນື້ອທີ່/ລາຄາ), ຕອນໃໝ່ຈະຖືກເພີ່ມ.</p>
                <button className="btn-p w-full" disabled={imp.busy || !imp.rows.length} onClick={importSave}>
                  {imp.busy ? "ກຳລັງບັນທຶກ..." : `💾 ບັນທຶກ ${imp.rows.length} ຕອນ ເຂົ້າ ${imp.project.code}`}
                </button>
              </div>
            )}
          </div>
        ))}
      </Modal>
    </div>
  );
}

const LOT_STATUS_LAO = { available: "ຫວ່າງ", reserved: "ຈອງ", sold: "ຂາຍແລ້ວ" };

// ---------- ບໍລິຫານຜູ້ໃຊ້ (admin/ceo) ----------
function Users() {
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState([]);
  const [form, setForm] = useState(null); // { ...profile, menus: Set|null }

  const load = () => {
    supabase.from("profiles").select("*").order("full_name").then(({ data }) => setUsers(data || []));
    supabase.from("user_menu_access").select("*").then(({ data }) => setAccess(data || []));
  };
  useEffect(() => { load(); }, []);

  const accOf = (uid) => access.filter((a) => a.user_id === uid && a.can_view).map((a) => a.menu_key);

  const openEdit = (u) => {
    const keys = accOf(u.id);
    setForm({ ...u, menus: keys.length ? new Set(keys) : null }); // null = ບໍ່ຈຳກັດ
  };
  const toggleMenu = (k) => {
    const s = new Set(form.menus || MENUS.map(([m]) => m));
    s.has(k) ? s.delete(k) : s.add(k);
    setForm({ ...form, menus: s });
  };

  const save = async (e) => {
    e.preventDefault();
    const { id, full_name, position, tel, role, is_active, menus } = form;
    const { error } = await supabase.from("profiles")
      .update({ full_name, position: position || null, tel: tel || null, role, is_active })
      .eq("id", id);
    if (error) return alert("ຜິດພາດ: " + error.message);
    // ສິດ menu: ບໍ່ຈຳກັດ = ລຶບທຸກແຖວ · ຈຳກັດ = ບັນທຶກສະເພາະ menu ທີ່ຕິກ
    await supabase.from("user_menu_access").delete().eq("user_id", id);
    if (menus && menus.size < MENUS.length) {
      const rows = [...menus].map((k) => ({ user_id: id, menu_key: k, can_view: true, can_edit: true }));
      const { error: e2 } = await supabase.from("user_menu_access").insert(rows);
      if (e2) return alert("ບັນທຶກສິດ menu ຜິດພາດ: " + e2.message);
    }
    setForm(null); load();
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-navy mb-1">ບໍລິຫານຜູ້ໃຊ້</h2>
      <p className="text-xs text-slate-500 mb-3">
        ສ້າງບັນຊີໃໝ່: Supabase Dashboard → Authentication → Add user (ອີເມວ+ລະຫັດຜ່ານ, ຕິກ Auto Confirm)
        — ຜູ້ໃຊ້ login ຄັ້ງທຳອິດແລ້ວ ຈະປາກົດໃນຕາຕະລາງນີ້ ຈຶ່ງມາຕັ້ງຊື່/ຕຳແໜ່ງ/ສິດ.
      </p>
      <Table cols={["ຊື່ພະນັກງານ", "ຕຳແໜ່ງ", "ເບີໂທ", "ບົດບາດ", "ສິດ menu", "ສະຖານະ", ""]}
        rows={users.map((u) => {
          const keys = accOf(u.id);
          const all = ["admin", "ceo"].includes(u.role) || !keys.length;
          return [
            <b key="n">{u.full_name}</b>, u.position || "—", u.tel || "—",
            <Badge key="r" color={["admin", "ceo"].includes(u.role) ? "navy" : "blue"}>{RNAME[u.role] || u.role}</Badge>,
            all ? <span key="m" className="text-slate-400 text-xs">ທຸກ menu</span>
                : <span key="m" className="text-xs">{keys.length}/{MENUS.length} menu</span>,
            u.is_active ? <Badge key="s" color="green">ໃຊ້ງານ</Badge> : <Badge key="s" color="red">ປິດ</Badge>,
            <button key="e" className="btn-o !py-1 !px-3 text-xs" onClick={() => openEdit(u)}>ແກ້ໄຂ</button>,
          ];
        })} />

      <Modal open={!!form} title={`✏️ ${form?.full_name || ""}`} onClose={() => setForm(null)} wide>
        {form && (
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <Field label="ຊື່ ແລະ ນາມສະກຸນ *"><input className="inp" required value={form.full_name || ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="ຕຳແໜ່ງ"><input className="inp" value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="ເບີໂທ"><input className="inp" value={form.tel || ""} onChange={(e) => setForm({ ...form, tel: e.target.value })} /></Field>
            <Field label="ບົດບາດ">
              <select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <b className="text-sm text-navy">ສິດເຂົ້າເຖິງ menu</b>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={!form.menus}
                    onChange={(e) => setForm({ ...form, menus: e.target.checked ? null : new Set(MENUS.map(([m]) => m)) })} />
                  ບໍ່ຈຳກັດ (ເຫັນທຸກ menu)
                </label>
              </div>
              {["admin", "ceo"].includes(form.role)
                ? <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">admin/ceo ເຫັນທຸກ menu ສະເໝີ</div>
                : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {MENUS.map(([k, l]) => (
                      <label key={k} className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg cursor-pointer ${form.menus ? "hover:bg-slate-50" : "opacity-40"}`}>
                        <input type="checkbox" disabled={!form.menus}
                          checked={!form.menus || form.menus.has(k)} onChange={() => toggleMenu(k)} />
                        {l}
                      </label>
                    ))}
                  </div>
                )}
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              ເປີດໃຊ້ງານບັນຊີ
            </label>
            <div className="col-span-2"><button className="btn-p w-full">💾 ບັນທຶກ</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ---------- ອັດຕາແລກປ່ຽນ ----------
function FxRates() {
  const [rates, setRates] = useState({});
  const [updated, setUpdated] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    supabase.from("fx_rates").select("*").then(({ data }) => {
      const m = {};
      let last = null;
      (data || []).forEach((r) => {
        m[r.currency] = r.rate_to_lak;
        if (!last || r.updated_at > last) last = r.updated_at;
      });
      setRates(m);
      setUpdated(last);
    });
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setSaved(false);
    const rows = [
      { currency: "LAK", rate_to_lak: 1 },
      ...CUR.map(([c]) => ({ currency: c, rate_to_lak: Number(rates[c]) || 0 })),
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("fx_rates").upsert(rows, { onConflict: "currency" });
    setBusy(false);
    if (error) alert("ຜິດພາດ: " + error.message);
    else { setSaved(true); load(); }
  };

  return (
    <>
      <h2 className="text-lg font-bold text-navy mb-1">ຕັ້ງຄ່າ — ອັດຕາແລກປ່ຽນ</h2>
      <p className="text-xs text-slate-500 mb-4">
        ຖານການຄິດໄລ່ = ກີບ (LAK). ໃຊ້ສຳລັບລາຍງານມູນຄ່າ ແລະ ກຳໄລລວມເປັນສະກຸນດຽວ.
      </p>

      <form onSubmit={save} className="card max-w-md space-y-4">
        <div className="flex items-center justify-between text-sm border-b border-dashed pb-3">
          <span className="font-semibold">1 ກີບ (LAK)</span>
          <span className="text-slate-500">= 1 ₭ (ຖານ)</span>
        </div>

        {CUR.map(([c, name, sym]) => (
          <div key={c} className="flex items-center gap-3">
            <div className="w-28 shrink-0">
              <div className="text-sm font-semibold">1 {c} {sym}</div>
              <div className="text-[11px] text-slate-400">{name}</div>
            </div>
            <span className="text-slate-400">=</span>
            <input
              className="inp !w-40" type="number" step="0.0001" min="0" required
              value={rates[c] ?? ""} placeholder="0"
              onChange={(e) => setRates({ ...rates, [c]: e.target.value })} />
            <span className="text-sm text-slate-500">₭</span>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <button className="btn-p" disabled={busy}>{busy ? "ກຳລັງບັນທຶກ..." : "💾 ບັນທຶກ"}</button>
          {saved && <span className="text-brand-green text-sm">✓ ບັນທຶກແລ້ວ</span>}
          {updated && <span className="text-[11px] text-slate-400 ml-auto">ອັບເດດ: {fdate(updated)}</span>}
        </div>
      </form>

      <p className="text-[11px] text-slate-400 mt-3 max-w-md">
        ໝາຍເຫດ: ນີ້ຄືອັດຕາມາດຕະຖານສຳລັບລາຍງານ. ແຕ່ລະສັນຍາ/ໃບຮັບເງິນຍັງເກັບອັດຕາຕົວຈິງມື້ນັ້ນແຍກຕ່າງຫາກ.
      </p>
    </>
  );
}

function Settings() {
  const { profile } = useApp();
  const isAdmin = ["admin", "ceo"].includes(profile?.role);
  return (
    <>
      <FxRates />
      {isAdmin && <Projects />}
      {isAdmin && <Users />}
    </>
  );
}

export default function Page() { return <Shell><Settings /></Shell>; }
