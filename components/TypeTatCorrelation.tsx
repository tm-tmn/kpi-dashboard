"use client";

import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { SERVICE_POINTS, PATIENT_TYPE_PAIRS } from "@/lib/constants";
import { RecordRow } from "@/lib/aggregate";
import { TatRecordRow } from "@/lib/aggregate-tat";
import { typeTatCorrelationsByPoint } from "@/lib/correlation";
import { pointMeta } from "@/lib/point-meta";
import { BentoCard } from "@/components/BentoCard";

// Below this many overlapping months, a Pearson r is numerically defined
// but not worth acting on — a hospital unit rarely has more than a year or
// two of live (non-legacy) data, so this stays a usable bar, not a wall of
// "ข้อมูลไม่พอ".
const MIN_MONTHS = 6;

type ChartColors = {
  tooltip: { background: string; border: string; borderRadius: number; fontSize: number; color: string };
  axisTick: string;
  grid: string;
};

/** r > 0 means "more of this patient type that month → longer TAT that
 * month"; r < 0 means the opposite. Neither implies the type itself is
 * slow — only that its share moved together with the point's overall TAT
 * across the months on record. */
function rBadge(r: number | null, n: number) {
  if (r == null || n < MIN_MONTHS) {
    return { label: "ข้อมูลไม่พอ", className: "bg-base-content/5 text-base-content/35" };
  }
  const abs = Math.abs(r);
  if (abs < 0.3) return { label: `r = ${r.toFixed(2)}`, className: "bg-base-content/5 text-base-content/50" };
  if (r > 0) return { label: `r = ${r.toFixed(2)}`, className: "bg-error/15 text-error" };
  return { label: `r = ${r.toFixed(2)}`, className: "bg-success/15 text-success" };
}

export function TypeTatCorrelation({
  attendance,
  tatRecords,
  chartColors,
  i = 0,
}: {
  attendance: RecordRow[];
  tatRecords: TatRecordRow[];
  chartColors: ChartColors;
  i?: number;
}) {
  const pointsWithData = useMemo(
    () => SERVICE_POINTS.filter((p) => attendance.some((r) => r.point === p)),
    [attendance]
  );
  const [point, setPoint] = useState<string | null>(null);
  const activePoint =
    point && (pointsWithData as readonly string[]).includes(point) ? point : pointsWithData[0];

  const types = useMemo(
    () => PATIENT_TYPE_PAIRS.filter((p) => p.point === activePoint).map((p) => p.type),
    [activePoint]
  );

  const correlations = useMemo(() => {
    if (!activePoint) return [];
    return typeTatCorrelationsByPoint(attendance, tatRecords, activePoint, types)
      .slice()
      .sort((a, b) => {
        const av = a.r != null && a.n >= MIN_MONTHS ? Math.abs(a.r) : -1;
        const bv = b.r != null && b.n >= MIN_MONTHS ? Math.abs(b.r) : -1;
        return bv - av;
      });
  }, [attendance, tatRecords, activePoint, types]);

  // Scatter-plot the strongest relationship found, so the ranked list above
  // has one concrete picture to back it up instead of just numbers.
  const featured = correlations.find((c) => c.r != null && c.n >= MIN_MONTHS) ?? null;

  if (!pointsWithData.length) return null;

  return (
    <BentoCard i={i} className="!p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="icon-badge flex h-7 w-7 items-center justify-center rounded-field bg-info/15 text-info">
            <Activity size={14} strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-base-content">
            ความสัมพันธ์ระหว่างประเภทผู้รับบริการกับ TAT
          </h2>
        </div>
        <select
          className="select select-sm select-bordered w-40 bg-base-200/60"
          value={activePoint}
          onChange={(e) => setPoint(e.target.value)}
        >
          {pointsWithData.map((p) => (
            <option key={p} value={p}>{pointMeta(p).short} — {p}</option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-[11px] text-base-content/40">
        ดูว่าในเดือนที่สัดส่วนผู้รับบริการประเภทหนึ่งๆ ของจุดนี้สูงขึ้น TAT รวมของจุดนั้นมักจะยาวขึ้นหรือสั้นลงด้วยหรือไม่
        — เป็นความสัมพันธ์เชิงสังเกตจากข้อมูลที่มี ไม่ใช่การพิสูจน์ความเป็นเหตุเป็นผล
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          {correlations.map(({ type, n, r }) => {
            const badge = rBadge(r, n);
            const widthPct = r != null && n >= MIN_MONTHS ? Math.min(100, Math.abs(r) * 100) : 0;
            const barColor = r != null && n >= MIN_MONTHS ? (r > 0 ? "var(--color-error, #f87171)" : "var(--color-success, #34d399)") : "transparent";
            return (
              <div key={type} className="rounded-field border border-base-content/8 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-base-content/70">{type}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-base-content/30">n={n}</span>
                    <span className={`rounded-field px-1.5 py-0.5 font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex h-1.5 items-center gap-0.5">
                  <div className="h-full flex-1 overflow-hidden rounded-full bg-base-content/5">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${widthPct / 2}%`,
                        marginLeft: `${50 - widthPct / 2}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {featured ? (
            <>
              <h3 className="mb-2 text-xs font-medium text-base-content/50">
                {featured.type} · r = {featured.r!.toFixed(2)}
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    type="number"
                    dataKey="sharePct"
                    name="สัดส่วนประเภทนี้"
                    unit="%"
                    tick={{ fontSize: 11, fill: chartColors.axisTick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="tatMinutes"
                    name="TAT รวม"
                    unit=" น."
                    tick={{ fontSize: 11, fill: chartColors.axisTick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={chartColors.tooltip}
                    formatter={(value, name) =>
                      name === "สัดส่วนประเภทนี้"
                        ? [`${Number(value).toFixed(1)}%`, name]
                        : [`${Number(value).toFixed(1)} นาที`, name]
                    }
                  />
                  <Scatter data={featured.series} fill="var(--color-info, #60a5fa)" />
                </ScatterChart>
              </ResponsiveContainer>
              <p className="mt-1 text-center text-[11px] text-base-content/35">
                แต่ละจุด = 1 เดือน ({featured.n} เดือน)
              </p>
            </>
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-center text-xs text-base-content/35">
              ยังไม่มีคู่ประเภทผู้รับบริการที่มีข้อมูลซ้อนทับกันมากพอ
              <br />
              (ต้องมีอย่างน้อย {MIN_MONTHS} เดือนที่มีทั้งจำนวนผู้รับบริการแยกประเภทและ TAT รวมของจุดนั้น)
            </div>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
