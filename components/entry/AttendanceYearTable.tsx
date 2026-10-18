"use client";

import { Fragment, useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { PATIENT_TYPE_PAIRS, SERVICE_POINTS } from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import { RecordRow, availableFiscalYears, fiscalYearTable, fiscalMonthLabels } from "@/lib/aggregate";
import { BentoCard } from "@/components/BentoCard";

/** Read-only year-at-a-glance table: every (จุดบริการ, ประเภท) row, Oct..Sep
 * columns, a per-point subtotal row, and a grand total — so the user can see
 * the whole fiscal year without flipping the month dropdown one at a time. */
export function AttendanceYearTable({ records }: { records: RecordRow[] }) {
  const years = useMemo(() => availableFiscalYears(records), [records]);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const selectedYear = pickedYear ?? years[years.length - 1] ?? null;

  const months = fiscalMonthLabels();
  const rows = useMemo(
    () => (selectedYear ? fiscalYearTable(records, selectedYear, PATIENT_TYPE_PAIRS) : []),
    [records, selectedYear]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!map.has(row.point)) map.set(row.point, []);
      map.get(row.point)!.push(row);
    }
    return map;
  }, [rows]);

  if (!selectedYear || years.length === 0) return null;

  const grandTotalByMonth = months.map((_, i) => rows.reduce((s, r) => s + r.values[i], 0));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <BentoCard i={0} className="!p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-base-content/40" />
          <h2 className="text-sm font-semibold text-base-content">ตารางข้อมูลทั้งปี (รายเดือน)</h2>
        </div>
        <select
          className="select select-sm select-bordered w-32 bg-base-200/60"
          value={selectedYear}
          onChange={(e) => setPickedYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>ปีงบ {y}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b border-white/10 text-base-content/50">
              <th className="sticky left-0 z-10 bg-base-100/90 py-2 pr-3 text-left font-medium backdrop-blur-sm">
                จุดบริการ / ประเภท
              </th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
              ))}
              <th className="py-2 pl-3 text-right font-medium">ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_POINTS.map((point) => {
              const pointRows = grouped.get(point) ?? [];
              const meta = pointMeta(point);
              const subtotal = months.map((_, i) => pointRows.reduce((s, r) => s + r.values[i], 0));
              const subtotalSum = pointRows.reduce((s, r) => s + r.total, 0);
              return (
                <Fragment key={point}>
                  {pointRows.map((row) => (
                    <tr
                      key={`${row.point}|${row.type}`}
                      className="border-b border-white/5 text-base-content/70 hover:bg-white/3"
                    >
                      <td className="sticky left-0 z-10 bg-base-100/90 py-1.5 pr-3 backdrop-blur-sm">
                        <span className="text-base-content/35">{meta.short} · </span>
                        {row.type}
                      </td>
                      {row.values.map((v, i) => (
                        <td key={i} className="stat-figure-num px-2 py-1.5 text-right">
                          {v.toLocaleString()}
                        </td>
                      ))}
                      <td className="stat-figure-num py-1.5 pl-3 text-right font-medium text-base-content/90">
                        {row.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-white/10 bg-white/4 font-semibold">
                    <td className="sticky left-0 z-10 bg-base-200/80 py-1.5 pr-3" style={{ color: meta.color }}>
                      รวม - {point}
                    </td>
                    {subtotal.map((v, i) => (
                      <td key={i} className="stat-figure-num px-2 py-1.5 text-right text-base-content">
                        {v.toLocaleString()}
                      </td>
                    ))}
                    <td className="stat-figure-num py-1.5 pl-3 text-right text-base-content">
                      {subtotalSum.toLocaleString()}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            <tr className="bg-primary/10 font-bold text-base-content">
              <td className="sticky left-0 z-10 bg-base-100/90 py-2 pr-3 backdrop-blur-sm">รวมทั้งหมด</td>
              {grandTotalByMonth.map((v, i) => (
                <td key={i} className="stat-figure-num px-2 py-2 text-right">{v.toLocaleString()}</td>
              ))}
              <td className="stat-figure-num py-2 pl-3 text-right">{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </BentoCard>
  );
}
