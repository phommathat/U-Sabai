"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { Badge } from "@/components/ui";
import { supabase } from "@/lib/supabase";

const DOC_TYPES = [
  ["id_card", "ບັດປະຈຳຕົວ"], ["family_book", "ສຳມະໂນຄົວ"],
  ["address_cert", "ໃບຢັ້ງຢືນທີ່ຢູ່"], ["kinship_cert", "ໃບຢັ້ງຢືນສາຍຢາດ"],
  ["photo", "ຮູບ 3x4"], ["contract_scan", "ສັນຍາເຊັນແລ້ວ (scan)"], ["other", "ອື່ນໆ"],
];

function Documents() {
  const [custs, setCusts] = useState([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [docs, setDocs] = useState({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    supabase.from("customers").select("id,code,full_name,tel").order("code").limit(500)
      .then(({ data }) => setCusts(data || []));
  }, []);

  const loadDocs = async (c) => {
    setSel(c);
    const { data } = await supabase.from("customer_documents").select("*").eq("customer_id", c.id);
    setDocs(Object.fromEntries((data || []).map((d) => [d.doc_type, d])));
  };

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
    else loadDocs(sel);
  };

  const view = async (d) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.file_path, 300);
    if (error) return alert(error.message);
    window.open(data.signedUrl, "_blank");
  };

  const list = custs.filter((c) => !q || c.full_name?.includes(q) || c.code?.includes(q));
  const done = DOC_TYPES.slice(0, 5).filter(([k]) => docs[k]).length;

  return (
    <>
      <h2 className="text-lg font-bold text-navy mb-4">ເອກະສານລູກຄ້າ</h2>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="card !p-2 max-h-[75vh] overflow-y-auto">
          <input className="inp mb-2" placeholder="🔍 ຄົ້ນຫາລູກຄ້າ..." value={q} onChange={(e) => setQ(e.target.value)} />
          {list.slice(0, 60).map((c) => (
            <button key={c.id} onClick={() => loadDocs(c)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${sel?.id === c.id ? "bg-navy text-white" : "hover:bg-slate-100"}`}>
              <b>{c.code}</b> {c.full_name}
            </button>
          ))}
        </div>
        <div className="card">
          {!sel ? (
            <div className="text-slate-400 text-center py-16">← ເລືອກລູກຄ້າເພື່ອເບິ່ງ/ອັບໂຫຼດເອກະສານ</div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div><b className="text-navy">{sel.full_name}</b> <span className="text-xs text-slate-400">({sel.code})</span></div>
                <Badge color={done === 5 ? "green" : "amber"}>{done}/5 ເອກະສານຫຼັກ</Badge>
              </div>
              {DOC_TYPES.map(([k, label]) => (
                <div key={k} className="flex items-center justify-between border-b border-dashed border-slate-200 py-2.5">
                  <span className="text-sm">{docs[k] ? "✅" : "⬜"} {label}</span>
                  <span className="flex gap-2 items-center">
                    {docs[k] && <button className="btn-o !py-1 !px-3 text-xs" onClick={() => view(docs[k])}>ເບິ່ງ</button>}
                    <label className="btn-p !py-1 !px-3 text-xs cursor-pointer">
                      {busy === k ? "ກຳລັງອັບໂຫຼດ..." : docs[k] ? "ປ່ຽນໄຟລ໌" : "⬆ ອັບໂຫຼດ"}
                      <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => upload(k, e.target.files[0])} />
                    </label>
                  </span>
                </div>
              ))}
              <div className="text-[11px] text-slate-400 mt-3">ໄຟລ໌ເກັບໃນ Supabase Storage (ສ່ວນຕົວ) — ເປີດເບິ່ງຜ່ານລິ້ງຊົ່ວຄາວ 5 ນາທີ</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() { return <Shell><Documents /></Shell>; }
