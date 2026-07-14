"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) setErr("ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
    else router.replace("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy">
      <form onSubmit={submit} className="bg-white rounded-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="U-Sabai Land and House" className="w-44 mx-auto" />
          <div className="text-xs text-slate-500 mt-2">ລະບົບຄຸ້ມຄອງໂຄງການດິນຈັດສັນ</div>
        </div>
        <label className="lbl">ອີເມວ</label>
        <input className="inp mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="lbl">ລະຫັດຜ່ານ</label>
        <input className="inp mb-4" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <div className="text-brand-red text-xs mb-3">{err}</div>}
        <button className="btn-p w-full" disabled={busy}>{busy ? "ກຳລັງກວດສອບ..." : "ເຂົ້າສູ່ລະບົບ"}</button>
        <div className="text-[11px] text-slate-400 mt-4 text-center">
          ບັນຊີຜູ້ໃຊ້ສ້າງໂດຍຜູ້ຄຸ້ມຄອງລະບົບເທົ່ານັ້ນ
        </div>
      </form>
    </div>
  );
}
