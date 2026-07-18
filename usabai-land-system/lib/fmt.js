const CUR_SYM = { THB: " ฿", USD: " $", LAK: " ₭" };
export const fmt = (n, cur = "LAK") =>
  n == null || n === "" ? "—"
  : Number(n).toLocaleString("en-US") + (CUR_SYM[cur] || " ₭");

export const fmtM = (n) =>
  n == null ? "—" : (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ລ້ານ";

// ---- ຫຼາຍສະກຸນ ----
export const FX_DEFAULT = { LAK: 1, THB: 620, USD: 21500 };
// ແປງ 1 ຈຳນວນ → ກີບ ດ້ວຍ map ອັດຕາ (rate_to_lak)
export const toLAK = (n, cur, fx = FX_DEFAULT) => Number(n || 0) * (fx[cur] ?? 1);
// format ຕາມສະກຸນ: ກີບ = ຫຍໍ້ເປັນ "ລ້ານ", ບາດ/ໂດລາ = ເຕັມ + ສັນຍາລັກ
export const fmtMoney = (n, cur = "LAK") =>
  cur === "LAK" ? fmtM(n) + " ₭" : fmt(n, cur);

export const fdate = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const LOT_STATUS = { available: "ຫວ່າງ", reserved: "ຈອງ", sold: "ຂາຍແລ້ວ" };
export const PAY_TYPE = { installment: "ຜ່ອນ", cash: "ສົດ", bank: "ທະນາຄານ", booking: "ຈອງ" };
export const CONTRACT_STATUS = {
  booking: "ຈອງ", paying: "ກຳລັງຜ່ອນ", overdue: "ຄ້າງຊຳລະ",
  completed: "ສຳເລັດ", cancelled: "ຍົກເລີກ",
};
export const DEED_STAGE = {
  not_eligible: "ຍັງບໍ່ຮອດເກນ 20%", doc_prep: "ກຽມເອກະສານ/ຍື່ນຟອມ",
  submitted: "ຍື່ນຫ້ອງການທີ່ດິນ", processing: "ກຳລັງດຳເນີນການ",
  issued: "ອອກໃບຕາດິນແລ້ວ", handed_over: "ສົ່ງມອບແລ້ວ",
};
export const BOOKING_STATUS = {
  active: "ຈອງຢູ່", converted: "ເຮັດສັນຍາແລ້ວ", expired: "ກາຍກຳນົດ",
  cancelled: "ຍົກເລີກ", refunded: "ຄືນເງິນແລ້ວ",
};

// ສ້າງຕາຕະລາງງວດ: ຜ່ອນ (ຄາບ 1/3/6 ເດືອນ) ຫຼື ສົດ (ງວດ 1/2 + ສ່ວນທີ່ເຫຼືອ)
export function buildInstallments(c) {
  const rows = [];
  if (c.pay_type === "installment") {
    if (c.down_payment > 0)
      rows.push({ seq: 0, due_date: c.sign_date, amount_due: c.down_payment });
    const per = Number(c.installment_period_months || 1);
    const start = new Date(c.first_due_date || c.sign_date);
    for (let k = 1; k <= Number(c.n_installments || 0); k++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + (k - 1) * per);
      rows.push({ seq: k, due_date: d.toISOString().slice(0, 10), amount_due: c.installment_amt });
    }
  } else if (c.pay_type === "cash") {
    let seq = 1, paid = 0;
    if (c.cash_pay1 > 0) { rows.push({ seq: seq++, due_date: c.sign_date, amount_due: c.cash_pay1 }); paid += Number(c.cash_pay1); }
    if (c.cash_pay2 > 0) { rows.push({ seq: seq++, due_date: null, amount_due: c.cash_pay2 }); paid += Number(c.cash_pay2); }
    const rest = Number(c.sale_price) - paid;
    if (rest > 0)
      rows.push({ seq, due_date: null, amount_due: rest,
        due_condition: c.balance_due_when === "after_deed_transfer" ? "after_deed_transfer" : null });
  }
  return rows;
}

// ---- ຕົວເລກ → ໂຕໜັງສືລາວ (ໃຊ້ໃນສັນຍາ/ໃບມັດຈຳ: "ຂຽນເປັນໂຕໜັງສື") ----
export const CUR_WORD = { LAK: "ກີບ", THB: "ບາດ", USD: "ໂດລາ" };
const LAO_DIGIT = ["ສູນ", "ໜຶ່ງ", "ສອງ", "ສາມ", "ສີ່", "ຫ້າ", "ຫົກ", "ເຈັດ", "ແປດ", "ເກົ້າ"];
function laoBelowMillion(n) {
  let s = "";
  for (const [v, w] of [[100000, "ແສນ"], [10000, "ໝື່ນ"], [1000, "ພັນ"], [100, "ຮ້ອຍ"]]) {
    const q = Math.floor(n / v);
    if (q) { s += LAO_DIGIT[q] + w; n %= v; }
  }
  const t = Math.floor(n / 10), u = n % 10;
  if (t) s += t === 1 ? "ສິບ" : t === 2 ? "ຊາວ" : LAO_DIGIT[t] + "ສິບ";
  if (u) s += t && u === 1 ? "ເອັດ" : LAO_DIGIT[u];
  return s;
}
export function laoWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return "ສູນ";
  if (n < 0) return "ລົບ" + laoWords(-n);
  let s = "";
  if (n >= 1e6) { s = laoWords(Math.floor(n / 1e6)) + "ລ້ານ"; n %= 1e6; }
  return s + (n ? laoBelowMillion(n) : "");
}
// "1,500,000 ₭" → "ໜຶ່ງລ້ານຫ້າແສນກີບຖ້ວນ"
export const moneyWords = (n, cur = "LAK") =>
  n == null || n === "" || Number(n) === 0 ? "" : laoWords(n) + (CUR_WORD[cur] || "ກີບ") + "ຖ້ວນ";
