// Import ຂໍ້ມູນຈາກ USabai_Data_2026_ປ້ອນຂໍ້ມູນຈິງ.xlsx ເຂົ້າ Supabase
// ໃຊ້: node scripts/import-excel.mjs <path-to-xlsx>
// ຕ້ອງມີ .env.local ທີ່ມີ NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const file = process.argv[2];
if (!file) { console.error("ໃຊ້: node scripts/import-excel.mjs <ໄຟລ໌.xlsx>"); process.exit(1); }
const wb = XLSX.readFile(file);
const sheet = (n) => XLSX.utils.sheet_to_json(wb.Sheets[n] || {}, { defval: null });
const key = (row, en) => { // ຫາຄ່າດ້ວຍຊື່ອັງກິດໃນວົງເລັບຂອງຫົວຕາຕະລາງ
  const k = Object.keys(row).find((h) => h.includes(`(${en})`));
  return k ? row[k] : null;
};
const skipExample = (rows, en) => rows.filter((r) => {
  const note = Object.entries(r).find(([h]) => h.includes("(note)"))?.[1];
  return key(r, en) && !(typeof note === "string" && note.startsWith("ຕົວຢ່າງ"));
});
const asDate = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 864e5).toISOString().slice(0, 10);
  const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
};

const LOT_ST = { "ຫວ່າງ": "available", "ຈອງ": "reserved", "ຂາຍແລ້ວ": "sold" };
const PAY_T = { "ຜ່ອນ": "installment", "ສົດ": "cash", "ທະນາຄານ": "bank", "ຈອງ": "booking" };
const CON_ST = { "ຈອງ": "booking", "ກຳລັງຜ່ອນ": "paying", "ຄ້າງຊຳລະ": "overdue", "ສຳເລັດ": "completed", "ຍົກເລີກ": "cancelled" };
const PRJ_ST = { "ກຳລັງພັດທະນາ": "developing", "ເປີດຂາຍ": "selling", "ຂາຍໝົດ": "sold_out", "ປິດໂຄງການ": "closed" };
const PERIOD = { "ທຸກ 1 ເດືອນ": 1, "ທຸກ 3 ເດືອນ": 3, "ທຸກ 6 ເດືອນ": 6 };

async function run() {
  // 1. ໂຄງການ
  const prjRows = skipExample(sheet("ໂຄງການ"), "project_code");
  const prjMap = {};
  for (const r of prjRows) {
    const row = {
      code: key(r, "project_code"), name: key(r, "name"),
      village: key(r, "village"), district: key(r, "district"), province: key(r, "province"),
      area_ha: key(r, "area_ha"), total_lots: key(r, "total_lots"),
      start_date: asDate(key(r, "start_date")), status: PRJ_ST[key(r, "status")] || "selling",
      note: key(r, "note"),
    };
    const { data, error } = await db.from("projects").upsert(row, { onConflict: "code" }).select().single();
    if (error) throw new Error("projects: " + error.message);
    prjMap[row.code] = data.id;
  }
  console.log("✓ ໂຄງການ:", Object.keys(prjMap).length);

  // 2. ຕອນດິນ
  const lotMap = {};
  for (const r of skipExample(sheet("ຕອນດິນ"), "lot_code")) {
    const pid = prjMap[key(r, "project_code")]; if (!pid) continue;
    const row = {
      project_id: pid, code: String(key(r, "lot_code")), zone: key(r, "zone"),
      size_sqm: key(r, "size_sqm") || 0, width_m: key(r, "width_m"), length_m: key(r, "length_m"),
      price_per_sqm: key(r, "price_per_sqm"), list_price: key(r, "list_price") || 0,
      currency: key(r, "currency") || "LAK", status: LOT_ST[key(r, "status")] || "available",
      parent_deed_no: key(r, "parent_deed_no"), note: key(r, "note"),
    };
    const { data, error } = await db.from("lots").upsert(row, { onConflict: "project_id,code" }).select().single();
    if (error) throw new Error(`lots ${row.code}: ` + error.message);
    lotMap[`${key(r, "project_code")}|${row.code}`] = data.id;
  }
  console.log("✓ ຕອນດິນ:", Object.keys(lotMap).length);

  // 3. ລູກຄ້າ
  const cusMap = {};
  for (const r of skipExample(sheet("ລູກຄ້າ"), "customer_code")) {
    const row = {
      code: key(r, "customer_code"), full_name: key(r, "full_name"), gender: key(r, "gender"),
      id_card_no: key(r, "id_card_no"), tel: key(r, "tel"), village: key(r, "village"),
      district: key(r, "district"), province: key(r, "province"), occupation: key(r, "occupation"),
      note: key(r, "note"),
    };
    const { data, error } = await db.from("customers").upsert(row, { onConflict: "code" }).select().single();
    if (error) throw new Error(`customers ${row.code}: ` + error.message);
    cusMap[row.code] = data.id;
  }
  console.log("✓ ລູກຄ້າ:", Object.keys(cusMap).length);

  // 4. ສັນຍາ
  const conMap = {};
  for (const r of skipExample(sheet("ສັນຍາ"), "contract_no")) {
    const pc = key(r, "project_code");
    const row = {
      contract_no: key(r, "contract_no"), project_id: prjMap[pc],
      lot_id: lotMap[`${pc}|${key(r, "lot_code")}`], customer_id: cusMap[key(r, "customer_code")],
      sign_date: asDate(key(r, "sign_date")) || "1900-01-01",
      pay_type: PAY_T[key(r, "pay_type")] || "cash",
      list_price: key(r, "list_price") || key(r, "sale_price") || 0,
      discount: key(r, "discount") || 0, sale_price: key(r, "sale_price") || 0,
      currency: key(r, "currency") || "LAK", booking_fee: key(r, "booking_fee") || 0,
      down_payment: key(r, "down_payment") || 0, n_installments: key(r, "n_installments") || 0,
      installment_period_months: PERIOD[key(r, "period_months")] || 1,
      installment_amt: key(r, "installment_amt") || 0,
      first_due_date: asDate(key(r, "first_due_date")),
      cash_pay1: key(r, "cash_pay1"), cash_pay2: key(r, "cash_pay2"),
      status: CON_ST[key(r, "status")] || "paying",
      sales_person: key(r, "sales_person"), note: key(r, "note"),
    };
    if (!row.project_id || !row.lot_id || !row.customer_id) { console.warn("ຂ້າມ:", row.contract_no); continue; }
    const { data, error } = await db.from("contracts").upsert(row, { onConflict: "contract_no" }).select().single();
    if (error) throw new Error(`contracts ${row.contract_no}: ` + error.message);
    conMap[row.contract_no] = data.id;
  }
  console.log("✓ ສັນຍາ:", Object.keys(conMap).length);

  // 5. ການຊຳລະ
  let np = 0;
  for (const r of skipExample(sheet("ການຊຳລະ"), "contract_no")) {
    const cid = conMap[key(r, "contract_no")]; if (!cid) continue;
    const { error } = await db.from("payments").insert({
      receipt_no: key(r, "receipt_no"), contract_id: cid,
      pay_date: asDate(key(r, "pay_date")) || "1900-01-01",
      amount_received: key(r, "amount_received") || 0,
      currency: key(r, "currency") || "LAK", channel: key(r, "channel"),
      note: [key(r, "note"), `ງວດທີ ${key(r, "installment_no") ?? "?"}`].filter(Boolean).join(" · "),
    });
    if (error) console.warn("payment error:", error.message);
    else np++;
  }
  console.log("✓ ການຊຳລະ:", np);
  console.log("ສຳເລັດທັງໝົດ ✅  (ວັນທີ 1900-01-01 = ບໍ່ມີວັນທີໃນໄຟລ໌ເດີມ — ຕ້ອງແກ້ໄຂພາຍຫຼັງ)");
}
run().catch((e) => { console.error("❌", e.message); process.exit(1); });
