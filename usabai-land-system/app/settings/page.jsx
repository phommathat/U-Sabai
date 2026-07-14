"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Field } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { fdate } from "@/lib/fmt";

const CUR = [
  ["THB", "ບາດ ໄທ", "฿"],
  ["USD", "ໂດລາ ສະຫະລັດ", "$"],
];

function Settings() {
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

export default function Page() { return <Shell><Settings /></Shell>; }
