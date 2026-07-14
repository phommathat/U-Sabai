"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const NAV = [
  ["/", "📊", "ພາບລວມ"],
  ["/lots", "🗺️", "ຕອນດິນ"],
  ["/customers", "👥", "ລູກຄ້າ"],
  ["/bookings", "📌", "ການຈອງ"],
  ["/contracts", "📄", "ສັນຍາຂາຍ"],
  ["/payments", "💰", "ການຊຳລະເງິນ"],
  ["/deeds", "📜", "ໃບຕາດິນ"],
  ["/costs", "🧾", "ຕົ້ນທຶນ & ກຳໄລ"],
  ["/documents", "📁", "ເອກະສານລູກຄ້າ"],
  ["/settings", "⚙️", "ຕັ້ງຄ່າ / ອັດຕາແລກປ່ຽນ"],
];

export default function Shell({ children }) {
  const [session, setSession] = useState(undefined);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase.from("projects").select("id,code,name").order("code").then(({ data }) => {
      setProjects(data || []);
      const saved = localStorage.getItem("projectId");
      const pid = data?.find((p) => p.id === saved) ? saved : data?.[0]?.id || "";
      setProjectId(pid);
    });
  }, [session]);

  useEffect(() => {
    if (session === null) router.replace("/login");
  }, [session, router]);

  if (session === undefined) return <div className="p-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>;
  if (session === null) return null;

  const pick = (id) => { setProjectId(id); localStorage.setItem("projectId", id); };
  const project = projects.find((p) => p.id === projectId) || null;

  return (
    <Ctx.Provider value={{ session, projects, projectId, project, pick }}>
      <div className="flex min-h-screen">
        <aside className="w-56 bg-navy text-white fixed inset-y-0 left-0 flex flex-col z-20">
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <img src="/logo-mark.png" alt="U-Sabai" className="w-11 h-11 rounded-full bg-white p-0.5 shrink-0" />
            <div>
              <div className="text-lg font-bold tracking-wider leading-none">U-<span className="text-brand-amber">SABAI</span></div>
              <div className="text-[9px] tracking-[2px] text-blue-200 mt-1">LAND AND HOUSE</div>
            </div>
          </div>
          <nav className="flex-1 py-3">
            {NAV.map(([href, ico, label]) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm border-l-2 ${
                  path === href
                    ? "bg-white/10 border-brand-amber text-white font-bold"
                    : "border-transparent text-slate-200 font-semibold hover:bg-white/5 hover:text-white"}`}>
                <span className="text-base">{ico}</span>{label}
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
            <div className="text-xs text-slate-500">{session.user.email}</div>
            <select className="inp !w-auto" value={projectId} onChange={(e) => pick(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>🏘️ {p.code} — {p.name}</option>
              ))}
            </select>
          </div>
          {children}
        </main>
      </div>
    </Ctx.Provider>
  );
}
