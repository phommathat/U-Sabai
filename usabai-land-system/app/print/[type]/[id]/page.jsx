"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, PAY_TYPE, moneyWords } from "@/lib/fmt";

const TITLES = {
  receipt: "ໃບຮັບເງິນ / RECEIPT",
  booking: "ໃບຈອງດິນ / LAND BOOKING SLIP",
  handover: "ໃບມອບ-ຮັບໃບຕາດິນ / TITLE DEED HANDOVER",
  contract: "ສັນຍາຊື້-ຂາຍດິນ",
  deposit: "ໃບສັນຍາມັດຈໍາເງິນຄ່າດິນ",
};

const CUSTOMER_COLS = "full_name, first_name, last_name, tel, age, nationality, occupation, village, district, province";

// ທີ່ຢູ່ບໍລິສັດ (ຜູ້ຂາຍ) — ຄົງທີ່ໃນທຸກເອກະສານ
const COMPANY = { village: "ໂພນຕ້ອງຈອມມະນີ", district: "ຈັນທະບູລີ", province: "ນະຄອນຫຼວງວຽງຈັນ" };

const Row = ({ l, v }) => (
  <div className="flex justify-between border-b border-dashed border-slate-300 py-2 text-[13.5px]">
    <span className="text-slate-500">{l}</span><b>{v ?? "—"}</b>
  </div>
);

// ຊ່ອງຈຸດໆ ຕາມແບບຟອມທາງການ — ຫວ່າງ = ປະໄວ້ຂຽນມື
const Dot = ({ v, w = "auto", cls = "" }) => (
  <span className={`border-b border-dotted border-slate-500 px-2 inline-block text-center font-semibold ${cls}`} style={{ minWidth: w }}>{v ?? ""}</span>
);

// ຫົວເອກະສານທາງການ ສປປ ລາວ + ເລກທີ/ວັນທີ
const LaoHeader = ({ no, date }) => {
  const dd = date ? fdate(date).split("/") : ["", "", ""];
  return (
    <>
      <div className="text-center">
        <div className="font-bold">ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</div>
        <div className="font-bold">ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</div>
        <div>--------==00==--------</div>
      </div>
      <div className="text-right text-[13px] mt-1">
        <div><b>No:</b> <Dot v={no} w="120px" /></div>
        <div className="mt-1">ວັນທີ <Dot v={dd[0]} w="34px" />/<Dot v={dd[1]} w="34px" />/<Dot v={dd[2]} w="52px" /></div>
      </div>
    </>
  );
};

export default function PrintPage() {
  const { type, id } = useParams();
  const [d, setD] = useState(null);
  const [seller, setSeller] = useState(null); // profile ຜູ້ໃຊ້ທີ່ login (fallback)
  const [creators, setCreators] = useState({}); // id → ຊື່ຜູ້ໃຊ້ລະບົບທີ່ອອກເອກະສານ (created_by)
  const [rcptRows, setRcptRows] = useState([]); // ແຖວຕາຕະລາງໃບມອບຮັບເງິນ (ດາວ+ງວດ ພ້ອມປະຫວັດຊຳລະ)
  const [firstPay, setFirstPay] = useState(0); // ເງິນຮັບຄັ້ງທຳອິດ (fallback ເງິນດາວ/ງວດ 1 ຂອງສັນຍາ import)
  const [err, setErr] = useState("");
  const [shot, setShot] = useState(false); // ກຳລັງສ້າງໄຟລ໌ຮູບ JPG

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setErr("ກະລຸນາ login ກ່ອນ ແລ້ວເປີດໜ້ານີ້ໃໝ່"); return; }
      // ຜູ້ຂາຍ: ດຶງຈາກ account ຜູ້ໃຊ້ລະບົບ (profiles)
      supabase.from("profiles").select("full_name, position, tel, village, district, province")
        .eq("id", s.session.user.id).maybeSingle().then(({ data: p }) => setSeller(p || {}));
      let q;
      if (type === "receipt")
        q = supabase.from("payments").select("*, installments(seq), contracts(contract_no, currency, sale_price, n_installments, sales_person, created_by, customers(full_name, first_name, last_name, tel, village, district, province), lots(code, size_sqm), projects(name, village, district, province))").eq("id", id).single();
      else if (type === "booking")
        q = supabase.from("bookings").select(`*, customers(${CUSTOMER_COLS}), lots(code, size_sqm, list_price, currency), projects(name, village, district, province)`).eq("id", id).single();
      else if (type === "deposit")
        q = supabase.from("bookings").select(`*, customers(${CUSTOMER_COLS}), lots(code, size_sqm, list_price, currency), projects(name, village, district, province)`).eq("id", id).single();
      else if (type === "handover")
        q = supabase.from("title_deeds").select("*, contracts(contract_no, customers(full_name, tel), lots(code, size_sqm), projects(name))").eq("id", id).single();
      else
        q = supabase.from("contracts").select(`*, customers(${CUSTOMER_COLS}), lots(code, size_sqm), projects(name, village, district, province), installments(seq, due_date, amount_due)`).eq("id", id).single();
      const { data, error } = await q;
      if (error) { setErr(error.message); return; }
      setD(data);
      // ຊື່ຜູ້ອອກເອກະສານ (created_by): ສັນຍາ/ໃບມັດຈຳ = ຜູ້ສ້າງເອກະສານ · ໃບຮັບເງິນ = ຜູ້ສ້າງສັນຍາ + ຜູ້ບັນທຶກຮັບເງິນ
      const cids = [...new Set([data?.created_by, data?.contracts?.created_by].filter(Boolean))];
      if (cids.length) {
        const { data: us } = await supabase.from("profiles").select("id,full_name").in("id", cids);
        setCreators(Object.fromEntries((us || []).map((u) => [u.id, u.full_name])));
      }
      // ສັນຍາ: ດຶງເງິນຮັບຄັ້ງທຳອິດ (ຕາມ pay_date) ເປັນ fallback ຂອງ "ງວດທີ 1 / ເງິນດາວ"
      // ເພາະສັນຍາ import ບໍ່ມີ down_payment ແລະ ບໍ່ມີງວດ 0 — ເງິນມື້ເຮັດສັນຍາຢູ່ໃນຕາຕະລາງ payments
      if (type === "contract" && data?.id) {
        const { data: ps } = await supabase.from("payments")
          .select("amount_received,pay_date,created_at").eq("contract_id", data.id);
        if (ps && ps.length) {
          ps.sort((a, b) => (String(a.pay_date) + a.created_at).localeCompare(String(b.pay_date) + b.created_at));
          setFirstPay(Number(ps[0].amount_received || 0));
        }
      }
      // ໃບມອບຮັບເງິນ: ດຶງປະຫວັດການຊຳລະທັງໝົດ → ໃສ່ຕາຕະລາງ ຕາມ ດາວ(seq0) + ງວດ1..N
      if (type === "receipt" && data?.contract_id) {
        const nInst = Number(data.contracts?.n_installments || 0);
        const sale = Number(data.contracts?.sale_price || 0);
        const { data: ps } = await supabase.from("payments")
          .select("amount_received, installment_id, installments(seq)").eq("contract_id", data.contract_id);
        // ລວມເງິນຮັບຕາມ seq (ຈ່າຍນອກງວດ / booking_fee → ນັບເປັນ ດາວ seq 0)
        const paidBySeq = {};
        (ps || []).forEach((p) => {
          const s = p.installments?.seq ?? 0;
          paidBySeq[s] = (paidBySeq[s] || 0) + Number(p.amount_received || 0);
        });
        let cum = 0;
        const rws = [];
        for (let s = 0; s <= nInst; s++) {
          const paid = paidBySeq[s] || 0;
          cum += paid;
          rws.push({ label: s === 0 ? "ດາວ" : `ງວດ${s}`, paid, remaining: paid > 0 ? Math.max(sale - cum, 0) : null });
        }
        setRcptRows(rws);
      }
    })();
  }, [type, id]);

  // ຊື່ໄຟລ໌ຕອນ "Save as PDF" = document.title → ຕັ້ງເປັນ ປະເພດເອກະສານ + ຊື່ລູກຄ້າ + ຕອນດິນ + ງວດ
  useEffect(() => {
    if (!d) return;
    const prev = document.title;
    const DOC = { receipt: "ໃບຮັບເງິນ", booking: "ໃບຈອງດິນ", deposit: "ໃບມັດຈຳ", contract: "ສັນຍາຊື້-ຂາຍດິນ", handover: "ໃບມອບໃບຕາດິນ" };
    const clean = (x) => String(x || "").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
    const cu = d.customers || d.contracts?.customers || {};
    const lot = d.lots?.code || d.contracts?.lots?.code || "";
    let part = "";
    if (type === "receipt") {
      const sq = d.installments?.seq;
      part = sq == null ? "ນອກງວດ" : sq === 0 ? "ດາວ" : `ງວດ ${sq}`;
    }
    const name = [DOC[type] || "ເອກະສານ", cu.full_name, lot, part].map(clean).filter(Boolean).join(" - ");
    document.title = name;
    return () => { document.title = prev; };
  }, [d, type]);

  // ?auto=1 → ເປີດ dialog ພິມ/Save as PDF ອັດຕະໂນມັດ (ໃຊ້ສົ່ງ PDF ໃຫ້ລູກຄ້າ)
  useEffect(() => {
    if (d && new URLSearchParams(window.location.search).get("auto"))
      setTimeout(() => window.print(), 700);
  }, [d]);

  if (err) return <div className="p-10 text-center text-brand-red">{err}</div>;
  if (!d) return <div className="p-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>;

  const today = fdate(new Date().toISOString());

  // ບັນທຶກເອກະສານເປັນຮູບ JPG — ໂຫຼດ html2canvas ຈາກ CDN ຕອນກົດ (ບໍ່ຕ້ອງເພີ່ມ dependency)
  const saveJpg = async () => {
    setShot(true);
    try {
      // ໂຫຼດຈາກ public/html2canvas.min.js ກ່ອນ (ໃຊ້ໄດ້ເຖິງບໍ່ມີເນັດນອກ) → ບໍ່ໄດ້ຈຶ່ງຕົກໄປ CDN
      if (!window.html2canvas) {
        const load = (src) => new Promise((ok, no) => {
          const sc = document.createElement("script");
          sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error(src));
          document.head.appendChild(sc);
        });
        await load("/html2canvas.min.js").catch(() =>
          load("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"));
      }
      const el = document.querySelector(".rcpt-sheet, .contract-sheet, .dep-sheet, .bk-sheet") || document.body;
      el.classList.add("shot");          // ບັງຄັບ layout A4 ຄືກັບ print
      await new Promise((r) => setTimeout(r, 60)); // ລໍ browser ຄິດ layout ໃໝ່
      const canvas = await window.html2canvas(el, {
        scale: 2,                    // ຄວາມລະອຽດ 2 ເທົ່າ ໃຫ້ອ່ານໄດ້ຊັດ
        backgroundColor: "#ffffff",
        useCORS: true,
        ignoreElements: (n) => n.classList && n.classList.contains("no-print"),
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.95);
      a.download = (document.title || "ເອກະສານ") + ".jpg";
      a.click();
      el.classList.remove("shot");
    } catch {
      document.querySelectorAll(".shot").forEach((n) => n.classList.remove("shot"));
      alert("ບັນທຶກຮູບບໍ່ສຳເລັດ — ກວດການເຊື່ອມຕໍ່ອິນເຕີເນັດ ຫຼື ໃຊ້ປຸ່ມ ພິມ → Save as PDF ແທນ");
    } finally {
      setShot(false);
    }
  };

  // ແຖບປຸ່ມ: ພິມ/PDF + ບັນທຶກເປັນຮູບ JPG
  const Actions = () => (
    <div className="no-print flex gap-2 mb-6">
      <button onClick={() => window.print()} className="btn-p flex-1">🖨 ພິມ / ບັນທຶກເປັນ PDF</button>
      <button onClick={saveJpg} disabled={shot} className="btn-o flex-1">
        {shot ? "⏳ ກຳລັງສ້າງຮູບ..." : "📷 ບັນທຶກເປັນ JPG"}
      </button>
    </div>
  );
  // ຊື່ຜູ້ຂາຍ = ຜູ້ໃຊ້ລະບົບທີ່ອອກເອກະສານ (created_by) → fallback sales_person → ຜູ້ໃຊ້ປັດຈຸບັນ
  const docSellerName = creators[d?.created_by] || d?.sales_person || seller?.full_name;
  // ແຖວ "ຜູ້ຂາຍ" — ຊື່ຜູ້ອອກເອກະສານ + ທີ່ຢູ່ບໍລິສັດ (ຫວ່າງ = ຈຸດໆໃຫ້ຂຽນມື)
  const SellerLine = ({ name = docSellerName }) => (
    <div>
      <b>ຜູ້ຂາຍ:</b> <Dot v={name} w="220px" cls="text-[1.15em] font-bold" />, ທີ່ຢູ່ບໍລິສັດ
      ບ້ານ <Dot v={COMPANY.village} w="150px" />,
      ເມືອງ <Dot v={COMPANY.district} w="140px" />,
      ແຂວງ <Dot v={COMPANY.province} w="150px" />.
    </div>
  );
  const ProjectLine = ({ pr }) => (
    <div>
      ເຊິ່ງເປັນເຈົ້າຂອງໂຄງການ: ຈັດສັນທີ່ດິນເພື່ອທີ່ຢູ່ອາໄສ ({pr?.name}),
      ບ້ານ <Dot v={pr?.village} w="150px" />,
      ເມືອງ <Dot v={pr?.district} w="140px" />,
      ແຂວງ <Dot v={pr?.province} w="150px" />.
    </div>
  );
  // ຂໍ້ມູນຜູ້ຊື້ inline: ທ່ານ ... ອາຍຸ ... ສັນຊາດ ... ອາຊີບ ... ບ້ານ ... ເມືອງ ... ແຂວງ ... ໂທ ...
  const BuyerInline = ({ cu }) => (
    <>
      ທ່ານ <Dot v={cu?.full_name} w="180px" cls="text-[1.15em] font-bold" /> ອາຍຸ <Dot v={cu?.age} w="40px" /> ປີ,
      ສັນຊາດ <Dot v={cu?.nationality} w="60px" /> ອາຊີບ <Dot v={cu?.occupation} w="110px" />
      {" "}ບ້ານຢູ່ປະຈຸບັນ <Dot v={cu?.village} w="120px" /> ເມືອງ <Dot v={cu?.district} w="110px" />
      {" "}ແຂວງ <Dot v={cu?.province} w="110px" /> ເບີໂທລະສັບ <Dot v={cu?.tel} w="110px" /> (ຜູ້ຊື້)
    </>
  );

  // ---------- ສັນຍາຊື້-ຂາຍດິນ (ສະບັບເຕັມ ຕາມ template ບໍລິສັດ) ----------
  if (type === "contract") {
    const cu = d.customers || {}, lo = d.lots || {}, pr = d.projects || {};
    const isCash = d.pay_type === "cash";
    const seq0 = (d.installments || []).find((i) => i.seq === 0); // ງວດ 0 = ເງິນດາວ
    // ເງິນດາວ / ງວດທີ 1 (ເງິນມື້ເຮັດສັນຍາ): ໄລ່ຕາມລຳດັບ —
    //   1) down_payment/cash_pay1 ທີ່ຄີໃນຟອມ  2) ງວດ 0  3) ເງິນມື້ຈອງ (booking_fee)  4) ເງິນຮັບຄັ້ງທຳອິດຈິງ
    // ສັນຍາ import ບໍ່ມີ down_payment → ໃຊ້ເງິນຮັບຈິງ ເພື່ອບໍ່ໃຫ້ຊ່ອງ "ງວດທີ 1" ຫວ່າງ
    const pay1 = isCash
      ? (Number(d.cash_pay1 || 0) || Number(d.booking_fee || 0) || firstPay || 0)
      : (Number(d.down_payment || 0) || Number(seq0?.amount_due || 0) || Number(d.booking_fee || 0) || firstPay || 0);
    const rest = Number(d.sale_price || 0) - pay1;
    const months = Number(d.n_installments || 0) * Number(d.installment_period_months || 1);
    const ins = (d.installments || []).filter((i) => i.seq > 0).sort((a, b) => a.seq - b.seq);
    const first = ins[0], last = ins[ins.length - 1];
    const payDay = first?.due_date ? new Date(first.due_date).getDate() : null;
    const Chk = ({ on }) => (
      <span className="w-5 h-5 border-2 border-black inline-flex items-center justify-center align-middle mr-1 text-[13px] font-bold">{on ? "✓" : ""}</span>
    );
    return (
      <div className="contract-sheet max-w-[820px] mx-auto p-8 bg-white min-h-screen text-black text-[13.5px] leading-[1.8] text-justify">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 7mm 12mm; }
            .contract-sheet { font-size: 11.5px !important; line-height: 1.45 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .contract-sheet .c-title { font-size: 18px !important; margin: 5px 0 !important; }
            .contract-sheet .c-note { font-size: 10.5px !important; }
            .contract-sheet .sig-area { margin-top: 16px !important; }
            .contract-sheet .sig-gap { margin-top: 64px !important; }
            .contract-sheet .c-wit { margin-top: 34px !important; }
            .contract-sheet .c-logo-wrap { width: 26mm !important; }
            .contract-sheet .c-logo { width: 26mm !important; height: 26mm !important; }
            .contract-sheet .co-name { font-size: 11px !important; }
          }
          /* .shot = ເປີດຕອນສ້າງໄຟລ໌ JPG → ບັງຄັບ layout ໃຫ້ຄືກັນກັບ print A4 ທຸກປະການ */
            .contract-sheet.shot { font-size: 11.5px !important; line-height: 1.45 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .contract-sheet.shot .c-title { font-size: 18px !important; margin: 5px 0 !important; }
            .contract-sheet.shot .c-note { font-size: 10.5px !important; }
            .contract-sheet.shot .sig-area { margin-top: 16px !important; }
            .contract-sheet.shot .sig-gap { margin-top: 64px !important; }
            .contract-sheet.shot .c-wit { margin-top: 34px !important; }
            .contract-sheet.shot .c-logo-wrap { width: 26mm !important; }
            .contract-sheet.shot .c-logo { width: 26mm !important; height: 26mm !important; }
            .contract-sheet.shot .co-name { font-size: 11px !important; }
          /* ເຕັມໜ້າ A4 ພ້ອມຂອບເຈ້ຍ → ຮູບອອກມາເປັນສັດສ່ວນ A4 ຄືກັບ PDF */
          .contract-sheet.shot { width: 210mm !important; max-width: 210mm !important;
            min-height: 297mm !important; padding: 7mm 12mm !important; margin: 0 !important; background: #fff !important; }
          .contract-sheet.shot .no-print { display: none !important; }
        `}</style>
        <Actions />
        <div className="relative">
          <div className="c-logo-wrap absolute left-0 -top-1 w-28 text-center">
            <img src="/logo-mark.png" alt="U-Sabai" className="c-logo w-28 h-28 object-contain mx-auto" />
            <div className="co-name text-[16px] font-bold leading-snug whitespace-nowrap">ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າ ຈຳກັດຜູ້ດຽວ</div>
          </div>
          <LaoHeader no={d.contract_no} date={d.sign_date} />
        </div>
        <div className="c-title text-center text-2xl font-bold my-3 underline underline-offset-4">ສັນຍາຊື້-ຂາຍດິນ</div>

        <div className="space-y-1">
          <SellerLine />
          <ProjectLine pr={pr} />
          <div>
            ໄດ້ຕົກລົງຂາຍດິນຈັດສັນລ໋ອກທີ <Dot v={lo.code} w="80px" /> ຂະໜາດ <Dot w="90px" />
            {" "}ເນື້ອທີ່ດິນ <Dot v={lo.size_sqm ? Number(lo.size_sqm) + " ຕລມ" : null} w="90px" />
            {" "}ເຮັດໃບຕາດິນຈຳນວນ <Dot v={d.n_deeds ?? 1} w="40px" /> ຕອນ ໃຫ້ແກ່ <BuyerInline cu={cu} />
          </div>
          <div className="c-note text-[12.5px]">
            <b>ໝາຍເຫດ:</b> ເນື້ອທີ່ດິນຂ້າງເທິງແມ່ນເນື້ອທີ່ຄາດຄະເນເບື້ອງຕົ້ນ, ເນື້ອທີ່ຕົວຈິງແມ່ນອີງຕາມເນື້ອທີ່ທີ່ລະບຸໃນໃບຕາດິນ,
            ຖ້າຫາກວ່າເນື້ອທີ່ຕົວຈິງຫາກໜ້ອຍກວ່າເນື້ອທີ່ຄາດຄະເນເບື້ອງຕົ້ນ, ຜູ້ຂາຍແມ່ນຍິນດີຄືນເງິນໃຫ້ຜູ້ຊື້ຕາມອັດຕາຄິດໄລ່ຕົວຈິງ
            ແລະ ຖ້າຫາກວ່າເນື້ອທີ່ຕົວຈິງຫາກຫຼາຍກວ່າເນື້ອທີ່ຄາດຄະເນ, ຜູ້ຊື້ຕ້ອງຍິນດີຈ່າຍເງິນເພີ່ມຕາມອັດຕາຄິດໄລ່ຕົວຈິງ.
          </div>
        </div>

        <div className="font-bold mt-2">ທັງສອງຝ່າຍຕົກລົງເຫັນດີຮ່ວມກັນໃນເງື່ອນໄຂການຊື້-ຂາຍ ແລະ ຂໍ້ກຳນົດດັ່ງລຸ່ມນີ້:</div>
        <div className="space-y-1 mt-1">
          <div>
            1. ຜູ້ຂາຍໄດ້ຕົກລົງເຫັນດີຂາຍດິນ ໃນລາຄາ <Dot v={fmt(d.sale_price, d.currency)} w="160px" /><br />
            (<Dot v={moneyWords(d.sale_price, d.currency)} w="320px" />)
          </div>
          <div>
            2. ຜູ້ຊື້ໄດ້ຕົກລົງຈ່າຍ: ງວດທີ 1: ຊຳລະຈຳນວນເງິນ <Dot v={pay1 ? fmt(pay1, d.currency) : null} w="150px" /> ໃນມື້ເຮັດສັນຍາຊື້ຂາຍ<br />
            (<Dot v={moneyWords(pay1, d.currency)} w="320px" />)<br />
            ງວດທີ່ເຫຼືອຈຳນວນ <Dot v={rest > 0 ? fmt(rest, d.currency) : null} w="150px" /><br />
            (<Dot v={moneyWords(rest > 0 ? rest : 0, d.currency)} w="320px" />)
          </div>
          <div className="pl-4">
            <Chk on={isCash} /> ຈ່າຍສົດພາຍຫຼັງແລ່ນໃບຕາດິນຂອບທອງເປັນຂອງລູກຄ້າແລ້ວ (ພາຍໃນ 30 ວັນ)
          </div>
          <div className="pl-4">
            <Chk on={!isCash && d.pay_type === "installment"} /> ຈ່າຍຜ່ອນກຳນົດເວລາຜ່ອນ <Dot v={months || null} w="46px" /> ເດືອນ,
            ດອກເບ້ຍ <Dot v={0} w="40px" /> % ຈຳນວນເງິນເດືອນລະ <Dot v={d.installment_amt ? fmt(d.installment_amt, d.currency) : null} w="130px" />
            {" "}ຈ່າຍທຸກວັນທີ <Dot v={payDay} w="40px" /> ຂອງແຕ່ລະເດືອນ,
            ເລີ່ມຈ່າຍວັນທີ <Dot v={first ? fdate(first.due_date) : null} w="90px" /> ຈົນເຖິງວັນທີ <Dot v={last ? fdate(last.due_date) : null} w="90px" />
            {" "}ຈົນຄົບຈຳນວນ <Dot v={rest > 0 ? fmt(rest, d.currency) : null} w="130px" />
          </div>
          <div className="pl-4">
            <Chk on={d.pay_type !== "cash" && d.pay_type !== "installment"} /> ຈ່າຍຮູບແບບອື່ນ <Dot v={d.pay_type !== "cash" && d.pay_type !== "installment" ? (d.pay_other || PAY_TYPE[d.pay_type]) : null} w="300px" />
          </div>
          <div>4. ຮູບແບບການຊຳລະເງິນແມ່ນສາມາດເຂົ້າມາຊຳລະກັບຜູ້ຂາຍໂດຍກົງ, ຊຳລະໂດຍໂອນຈ່າຍຜ່ານທະນາຄານ ຫຼື ຜ່ານລະບົບ BCEL One</div>
          <div>5. ຜູ້ຂາຍຈະເປັນຜູ້ຮັບຜິດຊອບແລ່ນມອບໂອນກຳມະສິດທີ່ດິນໃຫ້ກັບຜູ້ຊື້ ແລະ ເກັບຮັກສາໃບຕາດິນສະບັບແທ້ໄວ້ກັບຜູ້ຂາຍຈົນກວ່າລູກຄ້າຈະຊຳລະຄ່າດິນໝົດ.</div>
          <div>6. ຫາກຝ່າຍໃດຝ່າຍໜຶ່ງເຈຕະນາຜິດຕໍ່ສັນຍາການຊື້-ຂາຍສະບັບນີ້ ຜູ້ກ່ຽວຂໍຮັບຜິດຊອບຂໍ້ກຳນົດປັບໄໝດັ່ງນີ້:</div>
          <div className="pl-4">
            <b>ຄວາມຮັບຜິດຊອບຂອງຜູ້ຂາຍ:</b> ຜູ້ຂາຍຂໍຢັ້ງຢືນວ່າ ເອກະສານກຳມະສິດນຳໃຊ້ທີ່ດິນຂ້າງເທິງແມ່ນເປັນຂອງຜູ້ຂາຍແທ້,
            ຖ້າຫາກມີບັນຫາຈົນເປັນເຫດໃຫ້ບໍ່ສາມາດມອບໂອນກຳມະສິດເປັນຂອງຜູ້ຊື້ໄດ້, ຜູ້ຂາຍຂໍຍອມຮັບຜິດຊອບທົດແທນຄ່າເສຍຫາຍ
            ແລະ ສົ່ງຄືນເງິນທັງໝົດ 100% ທີ່ລູກຄ້າຊຳລະຜ່ານມາ.
          </div>
          <div className="pl-4"><b>ຄວາມຮັບຜິດຊອບຂອງລູກຄ້າ</b></div>
          <div className="pl-4">* ກໍລະນີລູກຄ້າຈ່າຍສົດ:</div>
          <div className="pl-8">
            - ພາຍຫຼັງທີ່ເຊັນມອບໂອນກຳມະສິດ ແລະ ແລ່ນໃບຕາດິນຂອບທອງສຳເລັດ ຜູ້ຊື້ຈະຕ້ອງຊຳລະເງິນສ່ວນທີ່ເຫຼືອທັງໝົດໃຫ້ກັບຜູ້ຂາຍ,
            ຜູ້ຂາຍຈຶ່ງຈະມອບໃບຕາດິນຂອບທອງໃຫ້ກັບຜູ້ຊື້.<br />
            - ໃນກໍລະນີທີ່ຜູ້ຊື້ ຫາກບໍ່ມາຊຳລະເງິນສ່ວນທີ່ເຫຼືອ ຫຼັງຈາກທີ່ແລ່ນໃບຕາດິນຂອບທອງສຳເລັດ ພາຍໃນ 01 ເດືອນ
            ຜູ້ຂາຍມີສິດຍົກເລີກໃບຕາດິນຂອບທອງ ແລະ ຖືວ່າຜູ້ຊື້ສະຫຼະສິດໃນເງິນຈຳນວນທີ່ໄດ້ຊຳລະໃນງວດທີ 1.
          </div>
          <div className="pl-4">* ກໍລະນີລູກຄ້າຈ່າຍຜ່ອນ:</div>
          <div className="pl-8">
            - ກໍລະນີລູກຄ້າຈ່າຍຜ່ອນກາຍກຳນົດເວລາທີ່ຕົກລົງກັນໄວ້ (<Dot v={months || null} w="40px" /> ເດືອນ) ທາງຜູ້ຂາຍຈະຄິດໄລ່ດອກເບ້ຍ 1.5% ຕໍ່ເດືອນ
            ເຊິ່ງຈະຄິດໄລ່ຈາກຍອດທີ່ຄ້າງຈ່າຍຕົວຈິງ.<br />
            - ກໍລະນີທີ່ຜູ້ຊື້ ຄ້າງການຜ່ອນຈ່າຍ ກາຍວັນເວລາທີ່ກຳນົດໄວ້ 3 ເດືອນ ຫຼື ຈ່າຍຊ້າຄົບ 3 ເດືອນ ຜູ້ຂາຍມີສິດຍົກເລີກສັນຍາ,
            ພ້ອມທັງໂອນກຳມະສິດເປັນຂອງຜູ້ຂາຍຄືນ ແລະ ຖືວ່າຜູ້ຊື້ສະຫຼະສິດເງິນຈຳນວນທີ່ໄດ້ຊຳລະຜ່ານມາ.<br />
            - ກໍລະນີທີ່ຜູ້ຊື້ຫາກຈ່າຍຊ້າ ການ 3 ຄັ້ງ (ໂດຍຈະນັບເປັນ 1 ຄັ້ງ ຖ້າຫາກຜູ້ຊື້ຫາກຈ່າຍຊ້າເກີນ 2 ອາທິດ ຕາມວັນທີກຳນົດໄວ້ໃນຂໍ້ 2 ຂອງສັນຍາ)
            ຜູ້ຂາຍມີສິດຍົກເລີກສັນຍາ, ພ້ອມທັງໂອນກຳມະສິດທີ່ດິນເປັນຂອງຜູ້ຂາຍຄືນ ແລະ ຖືວ່າຜູ້ຊື້ສະຫຼະສິດເງິນຈຳນວນທີ່ໄດ້ຊຳລະຜ່ານມາ.
          </div>
          <div>
            ສັນຍາສະບັບນີ້ໄດ້ເຮັດຂຶ້ນ 2 ສະບັບ, ເກັບມ້ຽນໄວ້ຝ່າຍລະ 1 ສະບັບ, ທັງສອງຝ່າຍໄດ້ອ່ານ ແລະ ເຂົ້າໃຈເນື້ອໃນຂອງສັນຍາສະບັບນີ້ແລ້ວເປັນຢ່າງດີ,
            ຈຶ່ງໄດ້ຍິນຍອມພ້ອມກັນລົງລາຍເຊັນໄວ້ເປັນຫຼັກຖານ, ຖ້າຫາກຝ່າຍໃດລະເມີດແມ່ນຈະຖືກປັບໄໝເປັນຈຳນວນເງິນ 20,000,000 ກີບ (ຊາວລ້ານກີບ)
            ແລະ ຖືກດຳເນີນຄະດີຕາມກົດໝາຍຂອງ ສປປ ລາວ.
          </div>
        </div>

        <div className="sig-area grid grid-cols-3 gap-6 mt-8 text-center font-bold">
          <div>ລາຍເຊັນຜູ້ຊື້<div className="sig-gap mt-28 font-bold text-[15px]">{cu.full_name}</div></div>
          <div>ລາຍເຊັນຜູ້ຂາຍ<div className="sig-gap mt-28 font-bold text-[15px]">{docSellerName}</div></div>
          <div>ນາຍບ້ານ, ບ້ານ <Dot w="110px" /><div className="sig-gap mt-28"></div></div>
        </div>
        <div className="c-wit grid grid-cols-2 gap-10 mt-12 text-[13px]">
          <div>ຊື່ ແລະ ລາຍເຊັນພະຍານ (1) <Dot w="170px" /></div>
          <div>ຊື່ ແລະ ລາຍເຊັນພະຍານ (2) <Dot w="170px" /></div>
        </div>

        <div className="no-print text-center text-[11px] text-slate-400 mt-8">
          ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
        </div>
      </div>
    );
  }

  // ---------- ໃບສັນຍາມັດຈຳເງິນຄ່າດິນ (ຕາມ template ບໍລິສັດ) ----------
  if (type === "deposit") {
    const cu = d.customers || {}, lo = d.lots || {}, pr = d.projects || {};
    const cur = d.currency || lo.currency || "LAK";
    const dep = [
      // ງວດ 1 = ມື້ອອກໃບມັດຈຳ (booking_date) · ງວດ 2 = ມື້ນັດເຮັດສັນຍາ (contract_due_date)
      { amt: d.deposit_amount, date: d.deposit1_date || d.booking_date, label: "ງວດທີ 1: ຜູ້ຊື້ໄດ້ຕົກລົງຈ່າຍເງິນມັດຈຳ" },
      { amt: d.deposit2_amount, date: d.deposit2_date || d.contract_due_date, label: "ງວດທີ 2: ຜູ້ຊື້ນັດຈ່າຍໃນມື້ເຮັດສັນຍາ" },
    ];
    return (
      <div className="dep-sheet max-w-[860px] mx-auto p-8 bg-white min-h-screen text-black text-[15.5px] leading-[2.05] text-justify">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 9mm 12mm; }
            .dep-sheet { font-size: 13.5px !important; line-height: 1.7 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .dep-sheet .d-title { font-size: 18px !important; margin: 5px 0 !important; }
            .dep-sheet .d-note { font-size: 12px !important; }
            .dep-sheet .sig-gap { margin-top: 68px !important; }
            .dep-sheet .d-wit { margin-top: 40px !important; }
            .dep-sheet .d-logo-wrap { width: 26mm !important; }
            .dep-sheet .d-logo { width: 26mm !important; height: 26mm !important; }
            .dep-sheet .co-name { font-size: 11px !important; }
          }
          /* .shot = ເປີດຕອນສ້າງໄຟລ໌ JPG → ບັງຄັບ layout ໃຫ້ຄືກັນກັບ print A4 ທຸກປະການ */
            .dep-sheet.shot { font-size: 13.5px !important; line-height: 1.7 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .dep-sheet.shot .d-title { font-size: 18px !important; margin: 5px 0 !important; }
            .dep-sheet.shot .d-note { font-size: 12px !important; }
            .dep-sheet.shot .sig-gap { margin-top: 68px !important; }
            .dep-sheet.shot .d-wit { margin-top: 40px !important; }
            .dep-sheet.shot .d-logo-wrap { width: 26mm !important; }
            .dep-sheet.shot .d-logo { width: 26mm !important; height: 26mm !important; }
            .dep-sheet.shot .co-name { font-size: 11px !important; }
          /* ເຕັມໜ້າ A4 ພ້ອມຂອບເຈ້ຍ → ຮູບອອກມາເປັນສັດສ່ວນ A4 ຄືກັບ PDF */
          .dep-sheet.shot { width: 210mm !important; max-width: 210mm !important;
            min-height: 297mm !important; padding: 9mm 12mm !important; margin: 0 !important; background: #fff !important; }
          .dep-sheet.shot .no-print { display: none !important; }
        `}</style>
        <Actions />
        <div className="relative">
          <div className="d-logo-wrap absolute left-0 -top-1 w-28 text-center">
            <img src="/logo-mark.png" alt="U-Sabai" className="d-logo w-28 h-28 object-contain mx-auto" />
            <div className="co-name text-[16px] font-bold leading-snug whitespace-nowrap">ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າ ຈຳກັດຜູ້ດຽວ</div>
          </div>
          <LaoHeader no={d.booking_no} date={d.booking_date} />
        </div>
        <div className="d-title text-center text-2xl font-bold my-3 underline underline-offset-4">ໃບສັນຍາມັດຈຳເງິນຄ່າດິນ</div>
        <div className="h-6" />

        <div className="space-y-1">
          <SellerLine />
          <ProjectLine pr={pr} />
          <div>
            ຮັບເງິນມັດຈຳຄ່າດິນຈາກ <BuyerInline cu={cu} /> ເຊິ່ງໄດ້ຕົກລົງຂາຍດິນຈັດສັນລ໋ອກທີ <Dot v={lo.code} w="80px" />
            {" "}ຂະໜາດ <Dot w="90px" /> ເນື້ອທີ່ດິນ <Dot v={lo.size_sqm ? Number(lo.size_sqm) + " ຕລມ" : null} w="90px" />
            {" "}ມູນຄ່າ <Dot v={lo.list_price ? fmt(lo.list_price, lo.currency) : null} w="140px" /><br />
            (<Dot v={moneyWords(lo.list_price, lo.currency)} w="320px" />)
          </div>
        </div>

        <div className="font-bold mt-2">ທັງສອງຝ່າຍຕົກລົງເຫັນດີພາຍໃຕ້ຂໍ້ກຳນົດດັ່ງລຸ່ມນີ້:</div>
        <div className="mt-1">
          <div className="font-bold">ມາດຕາ 1: ວ່າດ້ວຍການມັດຈຳເງິນຄ່າດິນ</div>
          {dep.map((g, i) => (
            <div key={i} className="pl-4">
              1.{i + 1} {g.label} ຈຳນວນ <Dot v={g.amt ? fmt(g.amt, cur) : null} w="170px" /> ວັນທີ <Dot v={g.date ? fdate(g.date) : null} w="110px" />
            </div>
          ))}
          <div className="pl-4">ໝາຍເຫດ: <Dot v={d.deposit_note || d.note} w="440px" /></div>

          <div className="font-bold mt-2">ມາດຕາ 2: ວ່າດ້ວຍໄລຍະເວລາໃນການມັດຈຳດິນ</div>
          <div className="pl-4">2.1 ສັນຍາມັດຈຳສະບັບນີ້ ນຳໃຊ້ໄດ້ພາຍໃນ 07 ວັນ ນັບແຕ່ມື້ລົງລາຍເຊັນ ແລະ ຮັບເງິນມັດຈຳເປັນຕົ້ນໄປ.</div>
          <div className="pl-4">2.2 ຜູ້ຂາຍບໍ່ມີສິດນຳດິນໄປຂາຍຕໍ່ໃຫ້ບຸກຄົນອື່ນ ແລະ ຜູ້ຊື້ກໍ່ບໍ່ສາມາດຖອນເງິນມັດຈຳ ແລະ ນຳດິນໄປຂາຍຕໍ່.</div>
          <div className="pl-4">
            2.3 ໃນກໍລະນີທີ່ຜູ້ຊື້ ຫາກບໍ່ມາຊຳລະເງິນຕາມວັນເວລາທີ່ໄດ້ລະບຸໄວ້ໃນມາດຕາ 02 ຖືວ່າຜູ້ຊື້ສະຫຼະສິດ
            ແລະ ຜູ້ຂາຍກໍ່ສາມາດນຳເອົາດິນຕອນດັ່ງກ່າວໄປຂາຍຕໍ່ໃຫ້ບຸກຄົນອື່ນໄດ້ ແລະ ຖືວ່າສັນຍາສະບັບນີ້ເປັນໂມຄະ
            ແລະ ຜູ້ຂາຍກໍ່ຈະບໍ່ສົ່ງເງິນມັດຈຳຄືນ.
          </div>
          <div className="d-note pl-4 text-[12.5px]">
            <b>ໝາຍເຫດ:</b> ໃນກໍລະນີທີ່ຜູ້ຊື້ຫາກມີການປ່ຽນແປງ, ບໍ່ຊື້ດິນ, ຜູ້ຊື້ຕ້ອງໄດ້ແຈ້ງພາຍໃນ 07 ວັນ ຫຼັງຈາກທີ່ຈ່າຍເງິນມັດຈຳ
            ຫຼື ແຈ້ງກ່ອນລ່ວງໜ້າມື້ນັດຊຳລະເງິນ, ຜູ້ຂາຍຈຶ່ງຈະຄືນເງິນມັດຈຳໃຫ້ 50% ຂອງມູນຄ່າມັດຈຳ
          </div>

          <div className="mt-2">
            <b>ມາດຕາ 3:</b> ສັນຍາສະບັບນີ້ໄດ້ເຮັດຂຶ້ນ 2 ສະບັບ, ເກັບມ້ຽນໄວ້ຝ່າຍລະ 1 ສະບັບ, ທັງສອງຝ່າຍໄດ້ອ່ານ ແລະ ເຂົ້າໃຈເນື້ອໃນຂອງສັນຍາສະບັບນີ້ແລ້ວເປັນຢ່າງດີ,
            ຈຶ່ງໄດ້ຍິນຍອມພ້ອມກັນລົງລາຍເຊັນໄວ້ເປັນຫຼັກຖານ, ຖ້າຫາກຝ່າຍໃດລະເມີດແມ່ນຈະຖືກປັບໄໝ ແລະ ຖືກດຳເນີນຄະດີຕາມກົດໝາຍຂອງ ສປປ ລາວ.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 mt-8 text-center font-bold">
          <div>ລາຍເຊັນຜູ້ຊື້<div className="sig-gap mt-28 font-bold text-[15px]">{cu.full_name}</div></div>
          <div>ລາຍເຊັນຜູ້ຂາຍ<div className="sig-gap mt-28 font-bold text-[15px]">{docSellerName}</div></div>
        </div>
        <div className="d-wit grid grid-cols-2 gap-10 mt-16 text-[13px]">
          <div>ຊື່ ແລະ ລາຍເຊັນພະຍານ (1) <Dot w="170px" /><div className="sig-gap mt-16" /></div>
          <div>ຊື່ ແລະ ລາຍເຊັນພະຍານ (2) <Dot w="170px" /><div className="sig-gap mt-16" /></div>
        </div>

        <div className="no-print text-center text-[11px] text-slate-400 mt-8">
          ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
        </div>
      </div>
    );
  }

  // ---------- ໃບມອບຮັບເງິນ (format ດຽວກັນກັບ ສັນຍາຊື້-ຂາຍ) ----------
  if (type === "receipt") {
    const c = d.contracts || {};
    const cu = c.customers || {};
    const pr = c.projects || {};
    const cash = (d.channel || "").includes("ສົດ");
    // ຜູ້ຂາຍ = ຜູ້ໃຊ້ລະບົບທີ່ສ້າງສັນຍາ (contracts.created_by) · ຜູ້ຮັບເງິນ = ຜູ້ໃຊ້ລະບົບທີ່ບັນທຶກການຮັບເງິນ (payments.created_by)
    const sellerName = creators[c.created_by] || c.sales_person || seller?.full_name;
    const receiverName = creators[d.created_by] || seller?.full_name;
    const cur = c.currency;
    // ແຖວ = ດາວ + ງວດ (ຈາກ rcptRows ທີ່ດຶງປະຫວັດ) · ແບ່ງ 2 ຝັ່ງ (ດາວ,ງວດ1.. | ງວດ..)
    const src = rcptRows.length ? rcptRows : ["ດາວ", ...Array.from({ length: Number(c.n_installments || 0) }, (_, i) => `ງວດ${i + 1}`)].map((l) => ({ label: l, paid: 0, remaining: null }));
    // 3 ຖັນຊ້າຍ = 21 ແຖວ (ດາວ + ງວດ 1-20) · 3 ຖັນຂວາ = 16 ແຖວ (ງວດ 21-36)
    // 5 ແຖວລຸ່ມສຸດຝັ່ງຂວາ ຮວມເປັນຊ່ອງດຽວ = ຜູ້ຮັບເງິນ + ກາຈ້ຳ (ບໍ່ຕີເສັ້ນຂວາ/ລຸ່ມ)
    const LEFT_ROWS = 21, SIG_ROWS = 5;
    const leftArr = src.slice(0, LEFT_ROWS);
    const rightArr = src.slice(LEFT_ROWS);
    const nRows = Math.max(LEFT_ROWS, rightArr.length + SIG_ROWS); // ງວດຫຼາຍກວ່າ 36 → ຂະຫຍາຍເອງ
    const sigRow = nRows - SIG_ROWS;
    const rows = Array.from({ length: nRows }, (_, i) => ({ L: leftArr[i] || null, R: rightArr[i] || null }));
    // 21 ແຖວ → 8.57mm · ຊ່ອງລາຍເຊັນ 5 ແຖວ ≈ 43mm ພໍໃສ່ກາຈ້ຳ 28mm
    const rowMM = Math.min(11, 180 / nRows).toFixed(2);
    return (
      <div className="rcpt-sheet max-w-[820px] mx-auto p-8 bg-white min-h-screen text-black text-[15px] leading-[1.8]">
        <style>{`
          .rcpt-sheet .r-sigcell { position: relative; vertical-align: top; font-weight: 700;
            border-right: 0 !important; border-bottom: 0 !important; }
          /* ກຸ່ມລາຍເຊັນ: ວາງ absolute ທັງໝົດ → ຍັບໄປຂວາ ແລະ ລົງລຸ່ມ ໃຫ້ຂອບລຸ່ມ
             ຢູ່ລະດັບດຽວກັນກັບແຖວ "ຮູບແບບການຈ່າຍເງິນ" (ລົ້ນອອກນອກຕາຕະລາງໄດ້ ເພາະບໍ່ມີເສັ້ນຂວາ/ລຸ່ມ) */
          .rcpt-sheet .r-sig-label { position: absolute; left: 16mm; top: 6mm; width: 40mm;
            text-align: center; font-size: 16px; }
          /* ຂະໜາດຈິງ: ວົງນອກແປດຫຼ່ຽມ ≈ 36mm (ໄຟລ໌ມີ padding ~7% → width 38.5mm)
             ອ້າງອີງ: ວົງນອກ/ວົງໃນຊັ້ນ 2 ໃນຮູບ = 747/542 px = 1.378 ເທົ່າ */
          .rcpt-sheet .stamp { position: absolute; left: 17mm; top: 14.5mm; width: 38.5mm;
            transform: rotate(-2deg); opacity: .9; pointer-events: none; }
          /* ຜູກທັງ left ແລະ right → ຊື່ຍາວຈະຕັດແຖວລົງ ບໍ່ລົ້ນອອກນອກຂອບເຈ້ຍ */
          .rcpt-sheet .r-payer { font-size: 16px; }
          .rcpt-sheet .r-name { position: absolute; left: 44mm; right: 0; top: 46mm;
            text-align: left; line-height: 1.25; font-weight: 700; font-size: 16px; }
          @media print {
            @page { size: A4 portrait; margin: 10mm 12mm; }
            .rcpt-sheet .stamp { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .rcpt-sheet { font-size: 13.5px !important; line-height: 1.6 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .rcpt-sheet .r-title { font-size: 19px !important; margin: 5px 0 !important; }
            .rcpt-sheet .co-name { font-size: 11px !important; }
            .rcpt-sheet .r-logo { width: 26mm !important; height: 26mm !important; }
            .rcpt-sheet .r-info { font-size: 13px !important; }
            .rcpt-sheet .rcpt-tbl { font-size: 12.5px !important; }
            .rcpt-sheet .rcpt-tbl td { padding: 1px 5px !important; line-height: 1.25 !important; }
          }
          /* .shot = ເປີດຕອນສ້າງໄຟລ໌ JPG → ບັງຄັບ layout ໃຫ້ຄືກັນກັບ print A4 ທຸກປະການ */
            .rcpt-sheet.shot .stamp { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .rcpt-sheet.shot { font-size: 13.5px !important; line-height: 1.6 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .rcpt-sheet.shot .r-title { font-size: 19px !important; margin: 5px 0 !important; }
            .rcpt-sheet.shot .co-name { font-size: 11px !important; }
            .rcpt-sheet.shot .r-logo { width: 26mm !important; height: 26mm !important; }
            .rcpt-sheet.shot .r-info { font-size: 13px !important; }
            .rcpt-sheet.shot .rcpt-tbl { font-size: 12.5px !important; }
            .rcpt-sheet.shot .rcpt-tbl td { padding: 1px 5px !important; line-height: 1.25 !important; }
          /* ເຕັມໜ້າ A4 ພ້ອມຂອບເຈ້ຍ → ຮູບອອກມາເປັນສັດສ່ວນ A4 ຄືກັບ PDF */
          .rcpt-sheet.shot { width: 210mm !important; max-width: 210mm !important;
            min-height: 297mm !important; padding: 10mm 12mm !important; margin: 0 !important; background: #fff !important; }
          .rcpt-sheet.shot .no-print { display: none !important; }
        `}</style>
        <Actions />
        <div className="relative">
          <div className="r-logo-wrap absolute left-0 -top-1 w-28 text-center">
            <img src="/logo-mark.png" alt="U-Sabai" className="r-logo w-28 h-28 object-contain mx-auto" />
            <div className="co-name text-[11px] font-bold leading-snug whitespace-nowrap">ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າ ຈຳກັດຜູ້ດຽວ</div>
          </div>
          <LaoHeader no={d.receipt_no} date={d.pay_date} />
        </div>
        <div className="r-title text-center text-2xl font-bold my-3 underline underline-offset-4">ໃບມອບຮັບເງິນ</div>

        <div className="r-info space-y-1 mt-2">
          <div className="whitespace-nowrap overflow-hidden">
            <b>ຜູ້ຂາຍ:</b> <Dot v={sellerName} w="170px" cls="text-[1.1em] font-bold" />, ບ້ານ <Dot v={COMPANY.village} w="120px" />,
            ເມືອງ <Dot v={COMPANY.district} w="110px" />, ແຂວງ <Dot v={COMPANY.province} w="120px" />.
          </div>
          <div className="whitespace-nowrap overflow-hidden">
            <b>ຜູ້ຊື້:</b> <Dot v={cu.full_name} w="180px" cls="text-[1.1em] font-bold" /> ລະຫັດດິນ <Dot v={c.lots?.code} w="80px" />
            {" "}ເນື້ອທີ່ <Dot v={c.lots?.size_sqm ? Number(c.lots.size_sqm) + " ຕລມ" : ""} w="90px" /> ລາຄາ <Dot v={fmt(c.sale_price, c.currency)} w="130px" />
          </div>
          <div className="whitespace-nowrap overflow-hidden">
            <b>ທີ່ຕັ້ງດິນ:</b> ບ້ານ <Dot v={pr.village || pr.name} w="160px" /> ເມືອງ <Dot v={pr.district} w="140px" /> ແຂວງ <Dot v={pr.province} w="150px" />
          </div>
        </div>

        <table className="rcpt-tbl w-full border-collapse mt-3 text-center text-[14px]">
          <thead>
            <tr className="font-bold">
              <td className="border-2 border-black p-2 w-14">ລ/ດ</td>
              <td className="border-2 border-black p-2">ເງິນຊຳລະຄັ້ງນີ້</td>
              <td className="border-2 border-black p-2">ຍອດທີ່ຍັງເຫຼືອ</td>
              <td className="border-2 border-black p-2 w-14">ລ/ດ</td>
              <td className="border-2 border-black p-2">ເງິນຊຳລະຄັ້ງນີ້</td>
              <td className="border-2 border-black p-2">ຍອດທີ່ຍັງເຫຼືອ</td>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ height: rowMM + "mm" }}>
                <td className="border-2 border-black px-2 font-bold">{r.L?.label ?? ""}</td>
                <td className="border-2 border-black px-2 font-bold">{r.L?.paid ? fmt(r.L.paid, cur) : ""}</td>
                <td className="border-2 border-black px-2">{r.L?.remaining != null ? (r.L.remaining > 0 ? fmt(r.L.remaining, cur) : "ຄົບແລ້ວ") : ""}</td>
                {i === sigRow ? (
                  <td className="r-sigcell border-2 border-black px-2" colSpan={3} rowSpan={SIG_ROWS}>
                    <div className="r-sig-label">ຜູ້ຮັບເງິນ</div>
                    {/* ກາຈ້ຳບໍລິສັດ: ໄຟລ໌ public/stamp.png (PNG ໂປ່ງໃສ) — ບໍ່ມີໄຟລ໌ = ເຊື່ອງອັດຕະໂນມັດ */}
                    <img src="/stamp.png" alt="" className="stamp" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    <div className="r-name">{receiverName}</div>
                  </td>
                ) : i > sigRow ? null : (<>
                  <td className="border-2 border-black px-2 font-bold">{r.R?.label ?? ""}</td>
                  <td className="border-2 border-black px-2 font-bold">{r.R?.paid ? fmt(r.R.paid, cur) : ""}</td>
                  <td className="border-2 border-black px-2">{r.R?.remaining != null ? (r.R.remaining > 0 ? fmt(r.R.remaining, cur) : "ຄົບແລ້ວ") : ""}</td>
                </>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-16 mt-4">
          <label className="flex items-center gap-2 font-bold">
            <span className="w-6 h-6 border-2 border-black inline-flex items-center justify-center">{cash ? "✓" : ""}</span> ຈ່າຍເງິນສົດ
          </label>
          <label className="flex items-center gap-2 font-bold">
            <span className="w-6 h-6 border-2 border-black inline-flex items-center justify-center">{cash ? "" : "✓"}</span> ຈ່າຍເງິນໂອນ
          </label>
        </div>

        {/* ຜູ້ຈ່າຍ = ຊື່ລູກຄ້າຈາກລະບົບ · ບໍ່ຕ້ອງເວັ້ນບ່ອນເຊັນ */}
        <div className="r-payer font-bold mt-3">ຜູ້ຈ່າຍ: {cu.full_name || "—"}</div>

        <div className="no-print text-center text-[11px] text-slate-400 mt-8">
          ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
        </div>
      </div>
    );
  }

  // ---------- ໃບຈອງດິນ (layout ທາງການ ຕາມ template ບໍລິສັດ) ----------
  if (type === "booking") {
    const cu = d.customers || {}, lo = d.lots || {}, pr = d.projects || {};
    const cur = d.currency || lo.currency || "LAK";
    return (
      <div className="bk-sheet max-w-[820px] mx-auto p-8 bg-white min-h-screen text-black text-[15px] leading-[2.0] text-justify">
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 10mm 12mm; }
            .bk-sheet { font-size: 14px !important; line-height: 2.0 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .bk-sheet .b-title { font-size: 18px !important; margin: 8px 0 !important; }
            .bk-sheet .b-logo-wrap { width: 26mm !important; }
            .bk-sheet .b-logo { width: 26mm !important; height: 26mm !important; }
            .bk-sheet .co-name { font-size: 11px !important; }
            .bk-sheet .b-sig { margin-top: 60px !important; }
            .bk-sheet .sig-gap { margin-top: 72px !important; }
          }
          /* .shot = ເປີດຕອນສ້າງໄຟລ໌ JPG → ບັງຄັບ layout ໃຫ້ຄືກັນກັບ print A4 ທຸກປະການ */
            .bk-sheet.shot { font-size: 14px !important; line-height: 2.0 !important; padding: 0 !important; max-width: 100% !important; min-height: 0 !important; }
            .bk-sheet.shot .b-title { font-size: 18px !important; margin: 8px 0 !important; }
            .bk-sheet.shot .b-logo-wrap { width: 26mm !important; }
            .bk-sheet.shot .b-logo { width: 26mm !important; height: 26mm !important; }
            .bk-sheet.shot .co-name { font-size: 11px !important; }
            .bk-sheet.shot .b-sig { margin-top: 60px !important; }
            .bk-sheet.shot .sig-gap { margin-top: 72px !important; }
          /* ເຕັມໜ້າ A4 ພ້ອມຂອບເຈ້ຍ → ຮູບອອກມາເປັນສັດສ່ວນ A4 ຄືກັບ PDF */
          .bk-sheet.shot { width: 210mm !important; max-width: 210mm !important;
            min-height: 297mm !important; padding: 10mm 12mm !important; margin: 0 !important; background: #fff !important; }
          .bk-sheet.shot .no-print { display: none !important; }
        `}</style>
        <Actions />
        <div className="relative">
          <div className="b-logo-wrap absolute left-0 -top-1 w-28 text-center">
            <img src="/logo-mark.png" alt="U-Sabai" className="b-logo w-28 h-28 object-contain mx-auto" />
            <div className="co-name text-[11px] font-bold leading-snug whitespace-nowrap">ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າ ຈຳກັດຜູ້ດຽວ</div>
          </div>
          <LaoHeader no={d.booking_no} date={d.booking_date} />
        </div>
        <div className="b-title text-center text-2xl font-bold my-3 underline underline-offset-4">ໃບຈອງດິນ</div>

        <div className="space-y-1">
          <SellerLine />
          <ProjectLine pr={pr} />
          <div>
            ໄດ້ຮັບການຈອງດິນຈັດສັນລ໋ອກທີ <Dot v={lo.code} w="80px" /> ຂະໜາດ <Dot w="90px" />
            {" "}ເນື້ອທີ່ດິນ <Dot v={lo.size_sqm ? Number(lo.size_sqm) + " ຕລມ" : null} w="90px" />
            {" "}ມູນຄ່າ <Dot v={lo.list_price ? fmt(lo.list_price, lo.currency) : null} w="140px" />
            {" "}ຈາກ <BuyerInline cu={cu} />
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div>
            1. ຜູ້ຊື້ໄດ້ວາງເງິນຈອງ (ມັດຈຳ) ຈຳນວນ <Dot v={d.deposit_amount ? fmt(d.deposit_amount, cur) : null} w="160px" /> ໃນວັນທີ <Dot v={fdate(d.booking_date)} w="110px" /><br />
            (<Dot v={moneyWords(d.deposit_amount, cur)} w="320px" />)
          </div>
          <div>
            2. ຜູ້ຊື້ຕ້ອງມາເຮັດສັນຍາຊື້-ຂາຍ ພາຍໃນວັນທີ <Dot v={d.contract_due_date ? fdate(d.contract_due_date) : null} w="110px" />.
          </div>
          <div className="pl-4 text-[12.5px]">
            <b>ໝາຍເຫດ:</b> ຫາກກາຍກຳນົດເຮັດສັນຍາຂ້າງເທິງໂດຍບໍ່ແຈ້ງເຫດຜົນ, ບໍລິສັດສະຫງວນສິດພິຈາລະນາການຈອງຄືນ
            ແລະ ເງື່ອນໄຂການຄືນເງິນຈອງແມ່ນເປັນໄປຕາມນະໂຍບາຍຂອງບໍລິສັດ.
          </div>
        </div>

        <div className="b-sig grid grid-cols-2 gap-10 mt-14 text-center font-bold">
          <div>ລາຍເຊັນຜູ້ຈອງ<div className="sig-gap mt-28 font-bold text-[15px]">{cu.full_name}</div></div>
          <div>ລາຍເຊັນຜູ້ຮັບຈອງ<div className="sig-gap mt-28 font-bold text-[15px]">{docSellerName}</div></div>
        </div>

        <div className="no-print text-center text-[11px] text-slate-400 mt-8">
          ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto p-8 bg-white min-h-screen text-slate-800">
      <Actions />

      <div className="text-center border-b-2 border-navy pb-4 mb-5">
        <div className="text-2xl font-bold text-navy tracking-wider">U-<span className="text-slate-500">SABAI</span></div>
        <div className="text-[10px] tracking-[4px] text-slate-500">LAND AND HOUSE</div>
        <div className="text-base font-bold text-navy mt-3">{TITLES[type]}</div>
      </div>

      {type === "handover" && (<>
        <Row l="ເລກສັນຍາ" v={d.contracts?.contract_no} />
        <Row l="ໂຄງການ / ຕອນດິນ" v={`${d.contracts?.projects?.name} / ${d.contracts?.lots?.code} (${Number(d.contracts?.lots?.size_sqm)} ຕລມ)`} />
        <Row l="ເລກໃບຕາດິນໃໝ່" v={d.new_deed_no} />
        <Row l="ວັນທີອອກໃບຕາດິນ" v={fdate(d.issue_date)} />
        <Row l="ວັນທີສົ່ງມອບ" v={fdate(d.handover_date)} />
        <Row l="ຜູ້ຮັບມອບ" v={d.received_by || d.contracts?.customers?.full_name} />
        <div className="text-[13px] leading-6 my-5 bg-slate-50 rounded-xl p-4">
          ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າສ໌ ໄດ້ສົ່ງມອບໃບຕາດິນສະບັບແທ້ ຕາມລາຍລະອຽດຂ້າງເທິງ
          ໃຫ້ແກ່ຜູ້ຊື້ຄົບຖ້ວນແລ້ວ ແລະ ຜູ້ຊື້ໄດ້ກວດກາຮັບເອົາຮຽບຮ້ອຍແລ້ວ.
        </div>
      </>)}

      <div className="grid grid-cols-2 gap-10 mt-12 text-center text-[13px]">
        <div><div className="border-t border-slate-400 pt-2 mt-14">ຜູ້ຮັບເງິນ / ຕາງໜ້າບໍລິສັດ</div></div>
        <div><div className="border-t border-slate-400 pt-2 mt-14">{type === "handover" ? "ຜູ້ຮັບມອບ" : "ລູກຄ້າ / ຜູ້ຈ່າຍເງິນ"}</div></div>
      </div>
      <div className="text-center text-[11px] text-slate-400 mt-8">
        ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
      </div>
    </div>
  );
}
