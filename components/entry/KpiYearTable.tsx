"use client";

import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { KPI_INDICATORS, fiscalYearMonths, MONTH_ABBR_TH } from "@/lib/constants";
import { RecordRow } from "@/lib/aggregate";
import { availableKpiYears, kpiMonthResult, KpiRecordRow } from "@/lib/aggregate-kpi";
import { BentoCard } from "@/components/BentoCard";

const MONTH_LABELS = [MONTH_ABBR_TH[9], MONTH_ABBR_TH[10], MONTH_ABBR_TH[11], ...MONTH_ABBR_TH.slice(0, 9)];

/** Read-only year-at-a-glance table: one row per indicator, Oct..Sep columns
 * (fiscal year, matching the attendance table), each cell the computed %. */
export function KpiYearTable({ records, attendance }: { records: KpiRecordRow[]; attendance: RecordRow[] }) {
  const years = useMemo(() => availableKpiYears(records), [records]);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const selectedYear = pickedYear ?? years[years.length - 1] ?? null;

  const months = useMemo(() => (selectedYear ? fiscalYearMonths(selectedYear) : []), [selectedYear]);

  if (!selectedYear || years.length === 0) return null;

  return (
    <BentoCard i={0} className="!p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-base-content/40" />
          <h2 className="text-sm font-semibold text-base-content">ตารางตัวชี้วัดคุณภาพทั้งปี (รายเดือน)</h2>
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
            <tr className="border-b border-base-content/10 text-base-content/50">
              <th className="sticky left-0 z-10 bg-base-100/90 py-2 pr-3 text-left font-medium backdrop-blur-sm">
                ตัวชี้วัด
              </th>
              {MONTH_LABELS.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KPI_INDICATORS.map((indicator) => (
              <tr key={indicator.id} className="border-b border-base-content/5 text-base-content/70 hover:bg-base-content/3">
                <td className="sticky left-0 z-10 max-w-[220px] truncate bg-base-100/90 py-1.5 pr-3 backdrop-blur-sm">
                  {indicator.name}
                </td>
                {months.map(({ year, month }, i) => {
                  const result = kpiMonthResult(indicator, records, attendance, year, month);
                  const cellClass =
                    result.status === "fail"
                      ? "text-error"
                      : result.status === "pass"
                        ? "text-success"
                        : "text-base-content/70";
                  return (
                    <td key={i} className={`stat-figure-num px-2 py-1.5 text-right ${cellClass}`}>
                      {result.pct == null ? "-" : `${result.pct.toFixed(0)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-base-content/35">&quot;-&quot; หมายถึงยังไม่มีข้อมูลเดือนนั้น</p>
    </BentoCard>
  );
}
