"use client";
import { useEffect, useState } from "react";
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
      {isAdmin && <Users />}
    </>
  );
}

export default function Page() { return <Shell><Settings /></Shell>; }
