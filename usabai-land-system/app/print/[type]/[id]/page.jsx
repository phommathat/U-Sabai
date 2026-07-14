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
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) { setErr("ກະລຸນາ login ກ່ອນ ແລ້ວເປີດໜ້ານີ້ໃໝ່"); return; }
      let q;
      if (type === "receipt")
        q = supabase.from("payments").select("*, contracts(contract_no, currency, sale_price, customers(full_name, tel), lots(code), projects(name))").eq("id", id).single();
      else if (type === "booking")
        q = supabase.from("bookings").select("*, customers(full_name, tel, village, district), lots(code, size_sqm, list_price, currency), projects(name)").eq("id", id).single();
      else if (type === "handover")
        q = supabase.from("title_deeds").select("*, contracts(contract_no, customers(full_name, tel), lots(code, size_sqm), projects(name))").eq("id", id).single();
      else
        q = supabase.from("contracts").select("*, customers(full_name, tel, village, district), lots(code, size_sqm), projects(name), installments(seq, due_date, amount_due)").eq("id", id).single();
      const { data, error } = await q;
      if (error) setErr(error.message); else setD(data);
    })();
  }, [type, id]);

  if (err) return <div className="p-10 text-center text-brand-red">{err}</div>;
  if (!d) return <div className="p-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>;

  const today = fdate(new Date().toISOString());

  return (
    <div className="max-w-[700px] mx-auto p-8 bg-white min-h-screen text-slate-800">
      <button onClick={() => window.print()} className="no-print btn-p mb-6 w-full">🖨 ພິມ / ບັນທຶກເປັນ PDF</button>

      <div className="text-center border-b-2 border-navy pb-4 mb-5">
        <div className="text-2xl font-bold text-navy tracking-wider">U-<span className="text-slate-500">SABAI</span></div>
        <div className="text-[10px] tracking-[4px] text-slate-500">LAND AND HOUSE</div>
        <div className="text-base font-bold text-navy mt-3">{TITLES[type]}</div>
      </div>

      {type === "receipt" && (<>
        <Row l="ເລກທີໃບຮັບເງິນ" v={d.receipt_no || d.id.slice(0, 8).toUpperCase()} />
        <Row l="ວັນທີຮັບເງິນ" v={fdate(d.pay_date)} />
        <Row l="ໂຄງການ" v={d.contracts?.projects?.name} />
        <Row l="ເລກສັນຍາ / ຕອນດິນ" v={`${d.contracts?.contract_no} / ${d.contracts?.lots?.code}`} />
        <Row l="ຮັບເງິນຈາກ" v={d.contracts?.customers?.full_name} />
        <Row l="ຊ່ອງທາງ" v={d.channel} />
        <Row l="ໝາຍເຫດ" v={d.note} />
        <div className="bg-slate-50 border-2 border-navy rounded-xl text-center p-5 my-6">
          <div className="text-xs text-slate-500">ຈຳນວນເງິນທີ່ຮັບ</div>
          <div className="text-3xl font-bold text-navy mt-1">{fmt(d.amount_received, d.currency)}</div>
        </div>
      </>)}

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
