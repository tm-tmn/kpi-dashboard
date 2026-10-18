"use client";

import { useMemo, useState } from "react";
import { Table2, FileDown } from "lucide-react";
import { KPI_INDICATORS, fiscalYearMonths, MONTH_ABBR_TH } from "@/lib/constants";
import { RecordRow } from "@/lib/aggregate";
import { availableKpiYears, KpiRecordRow } from "@/lib/aggregate-kpi";
import { buildIndicatorRows } from "@/lib/kpi-table";
import { BentoCard } from "@/components/BentoCard";

const MONTH_LABELS = [MONTH_ABBR_TH[9], MONTH_ABBR_TH[10], MONTH_ABBR_TH[11], ...MONTH_ABBR_TH.slice(0, 9)];

/** Read-only year-at-a-glance table mirroring the hospital's own Excel
 * summary 1:1 — ลำดับ / ตัวชี้วัด / เกณฑ์ประเมิน, then Oct..Sep + รวม, with the
 * same headline-%-plus-raw-count sub-rows the sheet shows under each
 * indicator (the entry form's exact field labels, so the two always agree).
 * "ส่งออก Excel" downloads the same structure as a real .xlsx file via
 * /api/kpi/export, built server-side with the identical row logic. */
export function KpiYearTable({ records, attendance }: { records: KpiRecordRow[]; attendance: RecordRow[] }) {
  const years = useMemo(() => availableKpiYears(records), [records]);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const selectedYear = pickedYear ?? years[years.length - 1] ?? null;

  const months = useMemo(() => (selectedYear ? fiscalYearMonths(selectedYear) : []), [selectedYear]);

  const indicatorRows = useMemo(() => {
    if (!months.length) return [];
    return KPI_INDICATORS.map((indicator, idx) => ({
      idx: idx + 1,
      indicator,
      rows: buildIndicatorRows(indicator, records, attendance, months),
    }));
  }, [records, attendance, months]);

  if (!selectedYear || years.length === 0) return null;

  return (
    <BentoCard i={0} className="!p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-base-content/40" />
          <h2 className="text-sm font-semibold text-base-content">สรุปตัวชี้วัดคุณภาพหน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/kpi/export?year=${selectedYear}`}
            className="btn btn-sm btn-outline gap-1.5 border-base-content/15 text-base-content/70 hover:border-primary hover:text-primary"
            title="ดาวน์โหลดตารางนี้เป็นไฟล์ Excel (.xlsx) โครงสร้างเดียวกับไฟล์ต้นฉบับ"
          >
            <FileDown size={14} />
            ส่งออก Excel
          </a>
          <select
            className="select select-sm select-bordered w-28 bg-base-200/60"
            value={selectedYear}
            onChange={(e) => setPickedYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>ปีงบ {y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1700px] text-xs">
          <thead>
            <tr className="border-b border-base-content/10 text-base-content/50">
              <th className="sticky left-0 z-10 w-10 bg-base-100/90 py-2 pr-2 text-center font-medium backdrop-blur-sm">
                ลำดับ
              </th>
              <th className="sticky left-10 z-10 min-w-[260px] bg-base-100/90 py-2 pr-3 text-left font-medium backdrop-blur-sm">
                ตัวชี้วัด
              </th>
              <th className="min-w-[220px] bg-base-100/90 py-2 pr-3 text-left font-medium">
                เกณฑ์ประเมิน
              </th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
              ))}
              <th className="px-2 py-2 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody>
            {indicatorRows.map(({ idx, indicator, rows }) =>
              rows.map((row, rowIdx) => (
                <tr
                  key={`${indicator.id}-${rowIdx}`}
                  className={`border-b border-base-content/5 hover:bg-base-content/3 ${
                    row.bold ? "bg-base-content/[0.02]" : ""
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-base-100/90 py-1.5 pr-2 text-center text-base-content/40 backdrop-blur-sm">
                    {rowIdx === 0 ? idx : ""}
                  </td>
                  <td
                    className={`sticky left-10 z-10 max-w-[260px] truncate bg-base-100/90 py-1.5 pr-3 backdrop-blur-sm ${
                      row.bold ? "font-semibold text-base-content" : "pl-4 text-base-content/55"
                    }`}
                    title={row.label}
                  >
                    {row.label}
                  </td>
                  <td className="max-w-[220px] py-1.5 pr-3 text-base-content/45">
                    {rowIdx === 0 ? indicator.criteria : ""}
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className={`stat-figure-num px-2 py-1.5 text-right ${cell.className ?? "text-base-content/70"}`}>
                      {cell.text}
                    </td>
                  ))}
                  <td className={`stat-figure-num px-2 py-1.5 text-right font-semibold ${row.total.className ?? "text-base-content/80"}`}>
                    {row.total.text}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-base-content/35">
        &quot;-&quot; หมายถึงยังไม่มีข้อมูลเดือนนั้น · รวม = ผลรวม/ค่าเฉลี่ยถ่วงน้ำหนักทั้งปีงบประมาณ
      </p>
    </BentoCard>
  );
}
