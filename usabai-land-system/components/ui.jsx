"use client";
import { useEffect, useState } from "react";

export const KPI = ({ label, value, note, warn }) => (
  <div className="card">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`text-xl font-bold mt-1 ${warn ? "text-brand-red" : "text-navy"}`}>{value}</div>
    {note && <div className="text-[11px] text-slate-400 mt-1">{note}</div>}
  </div>
);

const BADGE_COLOR = {
  green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700", red: "bg-red-50 text-red-600",
  gray: "bg-slate-100 text-slate-500", navy: "bg-indigo-50 text-indigo-800",
  graydark: "bg-slate-600 text-white",
};
export const Badge = ({ color = "gray", children }) => (
  <span className={`badge ${BADGE_COLOR[color]}`}>{children}</span>
);

export const Modal = ({ open, title, onClose, children, wide }) =>
  !open ? null : (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-2xl p-6 w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[88vh] overflow-y-auto`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-navy">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {children}
      </div>
    </div>
  );

export const Field = ({ label, children }) => (
  <div><label className="lbl">{label}</label>{children}</div>
);

// ---- ແບ່ງໜ້າ: 50 ລາຍການ/ໜ້າ (‹ ກ່ອນ · 1 … n · ຕໍ່ໄປ ›) ----
// ໃຊ້: const pg = usePager(list, [deps ທີ່ປ່ຽນແລ້ວ reset ໜ້າ 1]); → pg.rows ໃສ່ Table, <Pager pg={pg} /> ລຸ່ມຕາຕະລາງ
export function usePager(list, resetDeps = [], perPage = 50) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, resetDeps); // eslint-disable-line react-hooks/exhaustive-deps
  const pageCount = Math.max(1, Math.ceil(list.length / perPage));
  const cur = Math.min(page, pageCount);
  return { rows: list.slice((cur - 1) * perPage, cur * perPage), cur, pageCount, total: list.length, setPage };
}

export const Pager = ({ pg, unit = "ລາຍການ" }) => {
  const { cur, pageCount, total, setPage } = pg;
  if (pageCount <= 1) return null;
  return (
    <div className="flex gap-1 mt-4 items-center justify-center flex-wrap">
      <button className="btn-o !py-1 !px-3 text-xs" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>‹ ກ່ອນ</button>
      {Array.from({ length: pageCount }, (_, i) => i + 1)
        .filter((n) => n === 1 || n === pageCount || Math.abs(n - cur) <= 2)
        .map((n, i, arr) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && arr[i - 1] !== n - 1 && <span className="text-slate-400 px-1">…</span>}
            <button className={n === cur ? "btn-p !py-1 !px-3 text-xs" : "btn-o !py-1 !px-3 text-xs"}
              onClick={() => setPage(n)}>{n}</button>
          </span>
        ))}
      <button className="btn-o !py-1 !px-3 text-xs" disabled={cur >= pageCount} onClick={() => setPage(cur + 1)}>ຕໍ່ໄປ ›</button>
      <span className="text-xs text-slate-500 ml-2">ໜ້າ {cur}/{pageCount} · ທັງໝົດ {total} {unit}</span>
    </div>
  );
};

export function Table({ cols, rows, empty = "ບໍ່ມີຂໍ້ມູນ" }) {
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full">
        <thead><tr>{cols.map((c, i) => <th key={i} className="th">{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td className="td text-slate-400" colSpan={cols.length}>{empty}</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {r.map((cell, j) => <td key={j} className="td">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
