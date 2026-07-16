"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, fdate, PAY_TYPE } from "@/lib/fmt";

const TITLES = {
  receipt: "ໃບຮັບເງິນ / RECEIPT",
  booking: "ໃບຈອງດິນ / LAND BOOKING SLIP",
  handover: "ໃບມອບ-ຮັບໃບຕາດິນ / TITLE DEED HANDOVER",
  contract: "ຂໍ້ມູນສັນຍາຊື້-ຂາຍດິນ / LAND SALE CONTRACT SUMMARY",
};

const Row = ({ l, v }) => (
  <div className="flex justify-between border-b border-dashed border-slate-300 py-2 text-[13.5px]">
    <span className="text-slate-500">{l}</span><b>{v ?? "—"}</b>
  </div>
);

export default function PrintPage() {
  const { type, id } = useParams();
  const [d, setD] = useState(null);
  const [rem, setRem] = useState(null); // ຍອດເຫຼືອຫຼັງການຊຳລະຄັ້ງນີ້ (ໃບມອບຮັບເງິນ)
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setErr("ກະລຸນາ login ກ່ອນ ແລ້ວເປີດໜ້ານີ້ໃໝ່"); return; }
      let q;
      if (type === "receipt")
        q = supabase.from("payments").select("*, installments(seq), contracts(contract_no, currency, sale_price, customers(full_name, first_name, last_name, tel, village, district, province), lots(code, size_sqm), projects(name, village, district, province))").eq("id", id).single();
      else if (type === "booking")
        q = supabase.from("bookings").select("*, customers(full_name, tel, village, district), lots(code, size_sqm, list_price, currency), projects(name)").eq("id", id).single();
      else if (type === "handover")
        q = supabase.from("title_deeds").select("*, contracts(contract_no, customers(full_name, tel), lots(code, size_sqm), projects(name))").eq("id", id).single();
      else
        q = supabase.from("contracts").select("*, customers(full_name, tel, village, district), lots(code, size_sqm), projects(name), installments(seq, due_date, amount_due)").eq("id", id).single();
      const { data, error } = await q;
      if (error) { setErr(error.message); return; }
      setD(data);
      // ໃບມອບຮັບເງິນ: ຄິດຍອດເຫຼືອ ຫຼັງການຊຳລະຄັ້ງນີ້ (ສະສົມຕາມລຳດັບເວລາ)
      if (type === "receipt" && data?.contract_id) {
        const { data: ps } = await supabase.from("payments")
          .select("id,amount_received,pay_date,created_at").eq("contract_id", data.contract_id);
        let cum = 0;
        (ps || []).sort((a, b) => (a.pay_date + a.created_at).localeCompare(b.pay_date + b.created_at))
          .forEach((p) => { cum += Number(p.amount_received || 0); if (p.id === data.id) setRem(Number(data.contracts?.sale_price || 0) - cum); });
      }
    })();
  }, [type, id]);

  // ?auto=1 → ເປີດ dialog ພິມ/Save as PDF ອັດຕະໂນມັດ (ໃຊ້ສົ່ງ PDF ໃຫ້ລູກຄ້າ)
  useEffect(() => {
    if (d && new URLSearchParams(window.location.search).get("auto"))
      setTimeout(() => window.print(), 700);
  }, [d]);

  if (err) return <div className="p-10 text-center text-brand-red">{err}</div>;
  if (!d) return <div className="p-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>;

  const today = fdate(new Date().toISOString());

  // ---------- ໃບມອບຮັບເງິນ (layout ທາງການ ຕາມ template ບໍລິສັດ) ----------
  if (type === "receipt") {
    const c = d.contracts || {};
    const cu = c.customers || {};
    const pr = c.projects || {};
    const cash = (d.channel || "").includes("ສົດ");
    const pd = fdate(d.pay_date).split("/");
    const detail = d.installments?.seq != null
      ? (d.installments.seq === 0 ? "ເງິນດາວ/ມັດຈຳ" : `ຄ່າງວດ ທີ ${d.installments.seq}`)
      : (d.note || "ຊຳລະຄ່າດິນ");
    const Dot = ({ v, w = "auto" }) => (
      <span className="border-b border-dotted border-slate-500 px-2 inline-block text-center font-semibold" style={{ minWidth: w }}>{v ?? ""}</span>
    );
    return (
      <div className="max-w-[820px] mx-auto p-8 bg-white min-h-screen text-black text-[14px] leading-relaxed">
        <button onClick={() => window.print()} className="no-print btn-p mb-6 w-full">🖨 ພິມ / ບັນທຶກເປັນ PDF</button>

        <div className="text-center">
          <div className="font-bold">ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</div>
          <div className="font-bold">ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</div>
          <div>----------------00----------------</div>
        </div>

        <div className="flex justify-between items-start mt-2 mb-4">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="U-Sabai" className="w-16 h-16" />
            <div className="text-[13px]">
              <div className="font-bold">ບໍລິສັດ ຢູສະບາຍ ແລນ ແອນ ເຮົ້າ ຈຳກັດຜູ້ດຽວ</div>
              <div className="font-bold">U-Sabai Land and House Sole Co.,Ltd</div>
            </div>
          </div>
          <div className="text-center text-2xl font-bold mt-2">ໃບມອບຮັບເງິນ</div>
          <div className="text-[13px] mt-1">
            <div><b>No.</b> : <Dot v={d.receipt_no} w="110px" /></div>
            <div className="mt-1">ວັນທີ: <Dot v={pd[0]} w="34px" />/<Dot v={pd[1]} w="34px" />/<Dot v={pd[2]} w="48px" /></div>
          </div>
        </div>

        <div className="space-y-2">
          <div><b>ຜູ້ຂາຍ:</b> ນາງ ສັບພະສະຫວ່າງ ພອນສະຫວັນ, ທີ່ຢູ່ປະຈຸບັນ ບ້ານ ໂພນຕ້ອງຈອມມະນີ, ເມືອງ ຈັນທະບູລີ, ນະຄອນຫຼວງວຽງຈັນ.</div>
          <div>
            ຊື່ຜູ້ຊື້: <Dot v={cu.full_name} w="220px" />
            ລະຫັດດິນ: <Dot v={c.lots?.code} w="90px" />
            ເນື້ອທີ່ດິນ: <Dot v={c.lots?.size_sqm ? Number(c.lots.size_sqm) + " ຕລມ" : ""} w="100px" />
            ລາຄາ: <Dot v={fmt(c.sale_price, c.currency)} w="140px" />
          </div>
          <div>
            ທີ່ດິນຕັ້ງຢູ່ບ້ານ: <Dot v={pr.village || pr.name} w="220px" />
            ເມືອງ: <Dot v={pr.district} w="180px" />
            ແຂວງ: <Dot v={pr.province} w="180px" />
          </div>
        </div>

        <table className="w-full border-collapse border-2 border-black mt-4 text-center">
          <thead>
            <tr className="font-bold">
              <td className="border-2 border-black p-2 w-12">ລ/ດ</td>
              <td className="border-2 border-black p-2">ເນື້ອໃນການຊຳລະ</td>
              <td className="border-2 border-black p-2">ຈຳນວນເງິນຊຳລະຄັ້ງນີ້</td>
              <td className="border-2 border-black p-2">ຈຳນວນເງິນທີ່ຍັງເຫຼືອ</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border-2 border-black p-2">1</td>
              <td className="border-2 border-black p-2">{detail}</td>
              <td className="border-2 border-black p-2 font-bold">{fmt(d.amount_received, d.currency)}</td>
              <td className="border-2 border-black p-2 font-bold">{rem == null ? "…" : rem > 0 ? fmt(rem, c.currency) : "ຄົບແລ້ວ"}</td>
            </tr>
            {[2, 3, 4].map((n) => (
              <tr key={n}>
                <td className="border-2 border-black p-4"></td>
                <td className="border-2 border-black p-4"></td>
                <td className="border-2 border-black p-4"></td>
                <td className="border-2 border-black p-4"></td>
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

        <div className="grid grid-cols-3 gap-8 mt-8 text-center font-bold">
          <div>ຜູ້ຈ່າຍເງິນ<div className="mt-24 font-normal text-[12px] text-slate-400"></div></div>
          <div>ຜູ້ຮັບເງິນ<div className="mt-24 font-normal text-[12px] text-slate-400"></div></div>
          <div>ພະຍານ<div className="mt-24 font-normal text-[12px] text-slate-400"></div></div>
        </div>

        <div className="no-print text-center text-[11px] text-slate-400 mt-8">
          ອອກໂດຍລະບົບ U-Sabai Land System · ວັນທີພິມ {today}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto p-8 bg-white min-h-screen text-slate-800">
      <button onClick={() => window.print()} className="no-print btn-p mb-6 w-full">🖨 ພິມ / ບັນທຶກເປັນ PDF</button>

      <div className="text-center border-b-2 border-navy pb-4 mb-5">
        <div className="text-2xl font-bold text-navy tracking-wider">U-<span className="text-slate-500">SABAI</span></div>
        <div className="text-[10px] tracking-[4px] text-slate-500">LAND AND HOUSE</div>
        <div className="text-base font-bold text-navy mt-3">{TITLES[type]}</div>
      </div>

      {type === "booking" && (<>
        <Row l="ເລກທີໃບຈອງ" v={d.booking_no} />
        <Row l="ວັນທີຈອງ" v={fdate(d.booking_date)} />
        <Row l="ໂຄງການ" v={d.projects?.name} />
        <Row l="ຕອນດິນ" v={`${d.lots?.code} — ${Number(d.lots?.size_sqm)} ຕລມ`} />
        <Row l="ລາຄາຕັ້ງ" v={fmt(d.lots?.list_price, d.lots?.currency)} />
        <Row l="ຜູ້ຈອງ" v={`${d.customers?.full_name} (${d.customers?.tel || "—"})`} />
        <div className="bg-slate-50 border-2 border-navy rounded-xl text-center p-5 my-5">
          <div className="text-xs text-slate-500">ເງິນມັດຈຳ</div>
          <div className="text-3xl font-bold text-navy mt-1">{fmt(d.deposit_amount)}</div>
        </div>
        <div className="border-2 border-brand-amber bg-amber-50 rounded-xl p-4 text-center text-sm mb-4">
          ກຳນົດມາເຮັດສັນຍາພາຍໃນວັນທີ <b className="text-base">{fdate(d.contract_due_date)}</b><br />
          <span className="text-xs text-slate-500">ກາຍກຳນົດໂດຍບໍ່ແຈ້ງເຫດຜົນ ບໍລິສັດສະຫງວນສິດພິຈາລະນາການຈອງຄືນ</span>
        </div>
      </>)}

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

      {type === "contract" && (<>
        <Row l="ເລກສັນຍາ" v={d.contract_no} />
        <Row l="ວັນທີເຊັນ" v={fdate(d.sign_date)} />
        <Row l="ໂຄງການ / ຕອນດິນ" v={`${d.projects?.name} / ${d.lots?.code} (${Number(d.lots?.size_sqm)} ຕລມ)`} />
        <Row l="ຜູ້ຊື້" v={`${d.customers?.full_name} (${d.customers?.tel || "—"})`} />
        <Row l="ປະເພດການຊຳລະ" v={PAY_TYPE[d.pay_type]} />
        <Row l="ລາຄາຕັ້ງ / ສ່ວນຫຼຸດ" v={`${fmt(d.list_price, d.currency)} / ${fmt(d.discount, d.currency)}`} />
        <Row l="ລາຄາຂາຍຕົວຈິງ" v={<span className="text-lg">{fmt(d.sale_price, d.currency)}</span>} />
        {d.pay_type === "installment" && (<>
          <Row l="ເງິນດາວ" v={fmt(d.down_payment, d.currency)} />
          <Row l="ງວດ" v={`${d.n_installments} ງວດ · ທຸກ ${d.installment_period_months} ເດືອນ · ${fmt(d.installment_amt, d.currency)}/ງວດ`} />
        </>)}
        {d.installments?.length > 0 && (
          <div className="mt-4">
            <b className="text-navy text-sm">ຕາຕະລາງງວດ ({d.installments.length} ງວດ)</b>
            <div className="grid grid-cols-3 gap-x-4 text-[11.5px] mt-2">
              {d.installments.sort((a, b) => a.seq - b.seq).map((i) => (
                <div key={i.seq} className="flex justify-between border-b border-dotted py-0.5">
                  <span>{i.seq === 0 ? "ດາວ" : "ງວດ " + i.seq} · {fdate(i.due_date)}</span>
                  <span>{Number(i.amount_due).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
