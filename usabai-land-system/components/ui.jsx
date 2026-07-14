"use client";

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
