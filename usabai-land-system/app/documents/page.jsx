"use client";
import { useEffect, useState } from "react";
import Shell, { useApp } from "@/components/Shell";
import { Badge, Modal, Table } from "@/components/ui";
import { supabase } from "@/lib/supabase";

// ເອກະສານຫຼັກ 5 ຢ່າງ (matrix) + ເພີ່ມເຕີມ
const MAIN_DOCS = [
  ["id_card", "ບັດປະຈຳຕົວ"], ["family_book", "ສຳມະໂນຄົວ"],
  ["address_cert", "ຢັ້ງຢືນທີ່ຢູ່"], ["kinship_cert", "ຢັ້ງຢືນສາຍຢາດ"], ["photo", "ຮູບ 3x4"],
];
const EXTRA_DOCS = [["contract_scan", "ສັນຍາເຊັນແລ້ວ (scan)"], ["other", "ອື່ນໆ"]];

function Documents() {
  const { projects } = useApp();
  const [custs, setCusts] = useState([]);
  const [contracts, setContracts] = useState([]); // map ລູກຄ້າ ↔ ໂຄງການ
  const [allDocs, setAllDocs] = useState([]);     // ເອກະສານທຸກຄົນ (ສຳລັບ matrix)
  const [proj, setProj] = useState("");           // filter ໂຄງການ ("" = ທຸກໂຄງການ)
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState("");

  const load = () => {
    supabase.from("customers").select("id,code,full_name,tel").order("code").limit(500)
      .then(({ data }) => setCusts(data || []));
    supabase.from("contracts").select("customer_id,project_id").neq("status", "cancelled").limit(1000)
      .then(({ data }) => setContracts(data || []));
    supabase.from("customer_documents").select("*").limit(3000)
      .then(({ data }) => setAllDocs(data || []));
  };
  useEffect(() => { load(); }, []);

  // docs[customer_id][doc_type] = row
  const docs = {};
  allDocs.forEach((d) => ((docs[d.customer_id] = docs[d.customer_id] || {})[d.doc_type] = d));
  const custProjs = {};
  contracts.forEach((c) => (custProjs[c.customer_id] = custProjs[c.customer_id] || new Set()).add(c.project_id));

  const list = custs.filter((c) =>
    (!proj || custProjs[c.id]?.has(proj)) &&
    (!q || c.full_name?.includes(q) || c.code?.includes(q)));

  const upload = async (docType, file) => {
    if (!file) return;
    setBusy(docType);
    const path = `${sel.id}/${docType}_${Date.now()}.${file.name.split(".").pop()}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setBusy(""); return alert("ອັບໂຫຼດຜິດພາດ: " + upErr.message); }
    const { error } = await supabase.from("customer_documents")
      .upsert({ customer_id: sel.id, doc_type: docType, file_path: path }, { onConflict: "customer_id,doc_type" });
    setBusy("");
    if (error) alert("ຜິດພາດ: " + error.message);
    else load();
  };

  const signedUrl = async (d, download = false) => {
    const { data, error } = await supabase.storage.from("documents")
      .createSignedUrl(d.file_path, 300, download ? { download: true } : undefined);
    if (error) { alert(error.message); return null; }
    return data.signedUrl;
  };
  const view = async (d) => { const u = await signedUrl(d); if (u) window.open(u, "_blank"); };
  const download = async (d) => { const u = await signedUrl(d, true); if (u) window.open(u, "_blank"); };
  const printDoc = async (d) => {
    const u = await signedUrl(d); if (!u) return;
    if (d.file_path.toLowerCase().endsWith(".pdf")) { window.open(u, "_blank"); return; } // PDF: ພິມຈາກ viewer
    const w = window.open("", "_blank");
    w.document.write(`<html><body style="margin:0"><img src="${u}" style="max-width:100%" onload="setTimeout(()=>window.print(),300)" /></body></html>`);
    w.document.close();
  };

  const selDocs = sel ? (docs[sel.id] || {}) : {};
  const doneOf = (cid) => MAIN_DOCS.filter(([k]) => docs[cid]?.[k]).length;

  return (
    <>
      <div className="flex gap-2 items-center mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-navy mr-auto">ເອກະສານລູກຄ້າ</h2>
        <input className="inp !w-56" placeholder="🔍 ຄົ້ນຫາລູກຄ້າ..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* filter ຕາມໂຄງການ */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setProj("")}
          className={`px-3 py-1.5 rounded-full text-xs border ${!proj ? "bg-navy text-white border-navy" : "bg-white border-slate-300"}`}>ທຸກໂຄງການ</button>
        {projects.map((p) => (
          <button key={p.id} onClick={() => setProj(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs border ${proj === p.id ? "bg-navy text-white border-navy" : "bg-white border-slate-300"}`}>
            {p.code} — {p.name}
          </button>
        ))}
      </div>

      {/* matrix: ລູກຄ້າ × ເອກະສານ 5 ຢ່າງ */}
      <Table cols={["ລະຫັດ", "ລູກຄ້າ", ...MAIN_DOCS.map(([, l]) => l), "ຄົບ", ""]}
        empty="ບໍ່ມີລູກຄ້າໃນໂຄງການນີ້"
        rows={list.slice(0, 200).map((c) => [
          c.code,
          <button key="n" className="font-semibold text-navy underline decoration-dotted hover:text-brand-amber text-left"
            onClick={() => setSel(c)}>{c.full_name}</button>,
          ...MAIN_DOCS.map(([k]) => (
            docs[c.id]?.[k]
              ? <button key={k} title="ເປີດເບິ່ງ" onClick={() => view(docs[c.id][k])}>✅</button>
              : <span key={k} className="opacity-40">❌</span>
          )),
          <Badge key="d" color={doneOf(c.id) === 5 ? "green" : doneOf(c.id) > 0 ? "amber" : "gray"}>{doneOf(c.id)}/5</Badge>,
          <button key="m" className="btn-o !py-1 !px-3 text-xs" onClick={() => setSel(c)}>ຈັດການ</button>,
        ])} />

      {/* ລາຍລະອຽດ + ອັບໂຫຼດ/ເບິ່ງ/ດາວໂຫຼດ/ພິມ */}
      <Modal open={!!sel} title={sel ? `📁 ${sel.full_name} (${sel.code})` : ""} onClose={() => setSel(null)} wide>
        {sel && (
          <>
            <div className="flex justify-end mb-3">
              <Badge color={doneOf(sel.id) === 5 ? "green" : "amber"}>{doneOf(sel.id)}/5 ເອກະສານຫຼັກ</Badge>
            </div>
            {[...MAIN_DOCS, ...EXTRA_DOCS].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between border-b border-dashed border-slate-200 py-2.5 gap-2 flex-wrap">
                <span className="text-sm">{selDocs[k] ? "✅" : "⬜"} {label}</span>
                <span className="flex gap-1.5 items-center">
                  {selDocs[k] && (<>
                    <button className="btn-o !py-1 !px-2.5 text-xs" onClick={() => view(selDocs[k])}>👁 ເບິ່ງ</button>
                    <button className="btn-o !py-1 !px-2.5 text-xs" onClick={() => download(selDocs[k])}>⬇ ດາວໂຫຼດ</button>
                    <button className="btn-o !py-1 !px-2.5 text-xs" onClick={() => printDoc(selDocs[k])}>🖨 ພິມ</button>
                  </>)}
                  <label className="btn-p !py-1 !px-2.5 text-xs cursor-pointer">
                    {busy === k ? "ກຳລັງອັບໂຫຼດ..." : selDocs[k] ? "ປ່ຽນໄຟລ໌" : "⬆ ອັບໂຫຼດ"}
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => upload(k, e.target.files[0])} />
                  </label>
                </span>
              </div>
            ))}
            <div className="text-[11px] text-slate-400 mt-3">ໄຟລ໌ເກັບໃນ Supabase Storage (ສ່ວນຕົວ) — ເປີດຜ່ານລິ້ງຊົ່ວຄາວ 5 ນາທີ</div>
          </>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Shell><Documents /></Shell>; }
