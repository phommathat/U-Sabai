"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const NAV = [
  ["/", "📊", "ພາບລວມ", "overview"],
  ["/lots", "🗺️", "ຜັງຕອນດິນ", "lots"],
  ["/customers", "👥", "ລູກຄ້າ", "customers"],
  ["/bookings", "📌", "ໃບສັນຍາມັດຈຳ", "bookings"],
  ["/contracts", "📄", "ສັນຍາຂາຍ", "contracts"],
  ["/payments", "💰", "ການຊຳລະເງິນ", "payments"],
  ["/deeds", "📜", "ໃບຕາດິນ", "deeds"],
  ["/costs", "🧾", "ສະຫຼຸບການລົງທຶນ", "costs"],
  ["/documents", "📁", "ເອກະສານລູກຄ້າ", "documents"],
  ["/settings", "⚙️", "ຕັ້ງຄ່າ", "settings"],
];

export default function Shell({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [menuAccess, setMenuAccess] = useState(null); // null = ບໍ່ຈຳກັດ (ເຫັນທຸກ menu)
  const [projects, setProjects] = useState([]);
  const [projectIds, setProjectIds] = useState([]); // ໂຄງການທີ່ຕິກເລືອກ (ຫຼາຍອັນໄດ້)
  const [ddOpen, setDdOpen] = useState(false);
  const ddRef = useRef(null);
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    // ຂໍ້ມູນພະນັກງານທີ່ login — ໃຊ້ດຶງຊື່ພະນັກງານຂາຍໃສ່ໃບຈອງ/ສັນຍາ auto
    // ບັນຊີໃໝ່ (admin ສ້າງໃນ Supabase Dashboard): login ຄັ້ງທຳອິດ ສ້າງ profile ອັດຕະໂນມັດ
    supabase.from("profiles").select("id,full_name,role,tel,position").eq("id", session.user.id).maybeSingle()
      .then(async ({ data }) => {
        if (data) return setProfile(data);
        const { data: np } = await supabase.from("profiles")
          .insert({ id: session.user.id, full_name: session.user.email.split("@")[0], role: "sales" })
          .select().single();
        setProfile(np || { id: session.user.id, full_name: session.user.email, role: "sales" });
      });
    supabase.from("projects").select("id,code,name,status").order("code").then(({ data }) => {
      setProjects(data || []);
      let saved = [];
      try { saved = JSON.parse(localStorage.getItem("projectIds") || "[]"); } catch {}
      const valid = saved.filter((id) => data?.some((p) => p.id === id));
      setProjectIds(valid.length ? valid : (data || []).map((p) => p.id)); // default = ທຸກໂຄງການ
    });
  }, [session]);

  // ສິດຕໍ່ menu: admin/ceo ຫຼື ຍັງບໍ່ຕັ້ງສິດ = ເຫັນທຸກ menu
  useEffect(() => {
    if (!session || !profile) return;
    if (["admin", "ceo"].includes(profile.role)) { setMenuAccess(null); return; }
    supabase.from("user_menu_access").select("menu_key,can_view").eq("user_id", session.user.id)
      .then(({ data }) => setMenuAccess(data?.length ? data : null));
  }, [session, profile]);

  // ປິດ dropdown ເມື່ອ click ນອກ
  useEffect(() => {
    const h = (e) => { if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  if (session === undefined) return <div className="p-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>;
  if (session === null) return null;

  const pick = (ids) => { setProjectIds(ids); localStorage.setItem("projectIds", JSON.stringify(ids)); };
  const toggle = (id) => pick(projectIds.includes(id) ? projectIds.filter((x) => x !== id) : [...projectIds, id]);
  const allChecked = projects.length > 0 && projectIds.length === projects.length;

  // ຄ່າ back-compat: ໜ້າຟອມ (ເພີ່ມຕອນ/ຈອງ/ສັນຍາ) ຕ້ອງເລືອກໂຄງການດຽວ
  const projectId = projectIds.length === 1 ? projectIds[0] : "";
  const project = projects.find((p) => p.id === projectId) || null;
  const label = allChecked ? "🏘️ ທຸກໂຄງການ"
    : projectIds.length === 1 ? `🏘️ ${project?.code} — ${project?.name}`
    : projectIds.length === 0 ? "— ເລືອກໂຄງການ —"
    : `🏘️ ${projectIds.length} ໂຄງການ`;

  return (
    <Ctx.Provider value={{ session, profile, projects, projectIds, projectId, project, pick }}>
      <div className="flex min-h-screen">
        <aside className="w-56 bg-navy text-white fixed inset-y-0 left-0 flex flex-col z-20">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <img src="/logo-mark.png" alt="U-Sabai" className="w-16 h-16 rounded-full bg-white p-1.5 object-contain shrink-0" />
            <div>
              <div className="text-lg font-bold tracking-wider leading-none">U-<span className="text-brand-amber">SABAI</span></div>
              <div className="text-[9px] tracking-[2px] text-blue-200 mt-1">LAND AND HOUSE</div>
            </div>
          </div>
          <nav className="flex-1 py-3">
            {NAV.filter(([, , , key]) => !menuAccess || menuAccess.some((m) => m.menu_key === key && m.can_view)).map(([href, ico, label2]) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm border-l-2 ${
                  path === href
                    ? "bg-white/10 border-brand-amber text-white font-bold"
                    : "border-transparent text-slate-200 font-semibold hover:bg-white/5 hover:text-white"}`}>
                <span className="text-base">{ico}</span>{label2}
              </Link>
            ))}
          </nav>
          <button onClick={() => supabase.auth.signOut()}
            className="m-3 py-2 text-xs text-slate-300 border border-white/20 rounded-lg hover:bg-white/10">
            ອອກຈາກລະບົບ
          </button>
        </aside>
        <main className="ml-56 flex-1 p-6">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="text-base font-bold text-slate-700">👤 {profile?.full_name || session.user.email}{profile?.position ? ` · ${profile.position}` : ""}</div>
            {/* ເລືອກໂຄງການ: ຕິກໄດ້ຫຼາຍອັນ */}
            <div className="relative" ref={ddRef}>
              <button className="inp !w-auto text-left min-w-[220px]" onClick={() => setDdOpen(!ddOpen)}>
                {label} <span className="text-slate-400 float-right ml-2">▾</span>
              </button>
              {ddOpen && (
                <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-2 min-w-[260px]">
                  <label className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm font-semibold border-b border-slate-100 mb-1">
                    <input type="checkbox" checked={allChecked}
                      onChange={() => pick(allChecked ? [] : projects.map((p) => p.id))} />
                    ທຸກໂຄງການ
                  </label>
                  {projects.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                      <input type="checkbox" checked={projectIds.includes(p.id)} onChange={() => toggle(p.id)} />
                      <span className={["sold_out", "closed"].includes(p.status) ? "text-slate-400" : ""}>
                        {p.code} — {p.name}{["sold_out", "closed"].includes(p.status) && " (ປິດ)"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          {children}
        </main>
      </div>
    </Ctx.Provider>
  );
}
