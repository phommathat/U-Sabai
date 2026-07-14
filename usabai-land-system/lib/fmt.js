const CUR_SYM = { THB: " ฿", USD: " $", LAK: " ₭" };
export const fmt = (n, cur = "LAK") =>
  n == null || n === "" ? "—"
  : Number(n).toLocaleString("en-US") + (CUR_SYM[cur] || " ₭");

export const fmtM = (n) =>
  n == null ? "—" : (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " ລ້ານ";

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
