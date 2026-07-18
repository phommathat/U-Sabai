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

// ---- ຕົວໜັງສືເງິນ (ພາສາລາວ) ສຳລັບ ສັນຍາ/ໃບມັດຈຳ ----
const LAO_DIGIT = ["ສູນ", "ໜຶ່ງ", "ສອງ", "ສາມ", "ສີ່", "ຫ້າ", "ຫົກ", "ເຈັດ", "ແປດ", "ເກົ້າ"];
const LAO_POS = ["", "ສິບ", "ຮ້ອຍ", "ພັນ", "ໝື່ນ", "ແສນ"];
const CUR_WORD = { LAK: "ກີບ", THB: "ບາດ", USD: "ໂດລາ" };

// ຈຳນວນເຕັມ → ຄຳອ່ານພາສາລາວ (ຮອງຮັບເລກຫຼາຍລ້ານ ດ້ວຍ recursion)
function laoInt(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "ສູນ";
  if (n >= 1e6) {
    const hi = Math.floor(n / 1e6), lo = n % 1e6;
    return laoInt(hi) + "ລ້ານ" + (lo ? laoInt(lo) : "");
  }
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  let s = "";
  for (let i = 0; i < len; i++) {
    const d = digits[i], pos = len - 1 - i;
    if (d === 0) continue;
    if (pos === 1) s += d === 1 ? "ສິບ" : d === 2 ? "ຊາວ" : LAO_DIGIT[d] + "ສິບ";
    else if (pos === 0) {
      // "ເອັດ" ສະເພາະເມື່ອມີຫຼັກສິບ (ສິບເອັດ/ຊາວເອັດ); ຖ້າຫຼັກສິບເປັນ 0 → "ໜຶ່ງ" (ໜຶ່ງຮ້ອຍໜຶ່ງ)
      const tens = len > 1 ? digits[len - 2] : 0;
      s += d === 1 && tens !== 0 ? "ເອັດ" : LAO_DIGIT[d];
    } else s += LAO_DIGIT[d] + LAO_POS[pos];
  }
  return s;
}

// (ຈຳນວນ, ສະກຸນ) → "ໜຶ່ງລ້ານ...ກີບຖ້ວນ" · ຫວ່າງ/ບໍ່ແມ່ນເລກ → ""
export const moneyWords = (n, cur = "LAK") => {
  if (n == null || n === "" || isNaN(Number(n))) return "";
  return laoInt(Math.round(Number(n))) + (CUR_WORD[cur] || "ກີບ") + "ຖ້ວນ";
};

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
