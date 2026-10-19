"use client";

import { Fragment, useMemo, useState } from "react";
import { Table2, FileDown } from "lucide-react";
import { SERVICE_POINTS as DEFAULT_POINTS, TAT_STAGES, TAT_STAGE_META, MONTH_ABBR_TH } from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import { TatRecordRow, availableTatYears, tatYearTable } from "@/lib/aggregate-tat";
import { BentoCard } from "@/components/BentoCard";

/** Read-only year-at-a-glance table for TAT: every (จุดบริการ, ขั้นตอน) row,
 * Jan..Dec columns (calendar year), and a yearly average column. The
 * "รวมทั้งหมด" stage is bolded, matching the chart's emphasis. `points`
 * defaults to the original hardcoded list so any other caller that doesn't
 * pass the admin-managed list keeps working unchanged. */
export function TatYearTable({
  records,
  points = DEFAULT_POINTS as unknown as string[],
}: {
  records: TatRecordRow[];
  points?: string[];
}) {
  const years = useMemo(() => availableTatYears(records), [records]);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const selectedYear = pickedYear ?? years[years.length - 1] ?? null;

  const rows = useMemo(
    () => (selectedYear ? tatYearTable(records, selectedYear, points, TAT_STAGES) : []),
    [records, selectedYear, points]
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

  return (
    <BentoCard i={0} className="!p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Table2 size={16} className="text-base-content/40" />
          <h2 className="text-sm font-semibold text-base-content">ตาราง TAT ทั้งปี (รายเดือน)</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/tat/export?year=${selectedYear}`}
            className="btn btn-sm btn-outline gap-1.5 border-base-content/15 text-base-content/70 hover:border-primary hover:text-primary"
            title="ดาวน์โหลดตารางนี้เป็นไฟล์ Excel (.xlsx)"
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
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b border-base-content/10 text-base-content/50">
              <th className="sticky left-0 z-10 bg-base-100/90 py-2 pr-3 text-left font-medium backdrop-blur-sm">
                จุดบริการ / ขั้นตอน
              </th>
              {MONTH_ABBR_TH.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
              ))}
              <th className="py-2 pl-3 text-right font-medium">เฉลี่ยทั้งปี</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => {
              const pointRows = grouped.get(point) ?? [];
              const meta = pointMeta(point);
              return (
                <Fragment key={point}>
                  {pointRows.map((row) => {
                    const stageMeta = TAT_STAGE_META[row.stage as keyof typeof TAT_STAGE_META];
                    return (
                      <tr
                        key={`${row.point}|${row.stage}`}
                        className={`border-b border-base-content/5 hover:bg-base-content/3 ${
                          stageMeta.total ? "font-semibold text-base-content" : "text-base-content/70"
                        }`}
                      >
                        <td className="sticky left-0 z-10 bg-base-100/90 py-1.5 pr-3 backdrop-blur-sm">
                          <span className="text-base-content/35" style={{ color: stageMeta.total ? meta.color : undefined }}>
                            {stageMeta.total ? meta.short + " · " : `${meta.short} · `}
                          </span>
                          {row.stage}
                        </td>
                        {row.values.map((v, i) => (
                          <td key={i} className="stat-figure-num px-2 py-1.5 text-right">
                            {v == null ? "-" : v.toFixed(2)}
                          </td>
                        ))}
                        <td className="stat-figure-num py-1.5 pl-3 text-right">
                          {row.avg == null ? "-" : row.avg.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-base-content/35">หน่วยเป็นนาที · &quot;-&quot; หมายถึงยังไม่มีข้อมูลเดือนนั้น</p>
    </BentoCard>
  );
}
