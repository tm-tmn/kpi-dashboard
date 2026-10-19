import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, ShieldCheck } from "lucide-react";
import type { KpiIndicator } from "@/lib/constants";
import type { KpiMonthResult } from "@/lib/aggregate-kpi";
import { BentoCard } from "@/components/BentoCard";

export type ExecutiveSummaryItem = {
  indicator: KpiIndicator;
  result: KpiMonthResult;
  status: "pass" | "fail" | null;
  /** This month's pct vs last month's, or null when either side is missing
   * (no prior month, or this/last month has no computable pct). */
  trend: "up" | "down" | null;
};

/** One-page-glance view of all 6 quality indicators for someone who doesn't
 * have time to scroll the detailed score tiles / trend charts below: just
 * PASS/FAIL and whether each indicator moved the right way since last
 * month. Deliberately denser than the score-tile grid further down the
 * page — this is the "read it in five seconds" version. */
export function ExecutiveSummary({
  items,
  icons,
  accents,
  monthLabel,
  controls,
  i = 0,
}: {
  items: ExecutiveSummaryItem[];
  icons: Record<string, LucideIcon>;
  accents: string[];
  monthLabel: string;
  /** Optional month/year picker (or any other control) rendered next to the
   * month label, so the caller decides how the viewed month is chosen
   * without this component needing to know about fiscal-year logic. */
  controls?: ReactNode;
  i?: number;
}) {
  if (!items.length) return null;
  const passCount = items.filter((it) => it.status === "pass").length;
  const failCount = items.filter((it) => it.status === "fail").length;

  return (
    <BentoCard i={i} className="!p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="icon-badge flex h-7 w-7 shrink-0 items-center justify-center rounded-field bg-primary/15 text-primary">
            <ShieldCheck size={14} strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-base-content">สรุปภาพรวมตัวชี้วัดคุณภาพ</h2>
          <span className="text-xs text-base-content/40">· {monthLabel}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          {controls}
          <div className="flex items-center gap-2 text-xs font-medium">
          {failCount > 0 && (
            <span className="flex items-center gap-1 rounded-field bg-error/15 px-2 py-0.5 text-error">
              <XCircle size={11} /> ไม่ผ่าน {failCount}
            </span>
          )}
          <span className="flex items-center gap-1 rounded-field bg-success/15 px-2 py-0.5 text-success">
            <CheckCircle2 size={11} /> ผ่าน {passCount}/{items.length}
          </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {items.map(({ indicator, result, status, trend }, idx) => {
          const Icon = icons[indicator.id] ?? ShieldCheck;
          const accent = accents[idx % accents.length];
          // "up" is only good news when the target is a floor to clear; for
          // a ceiling-style target ("min", e.g. rejection rate) a falling
          // line is the improvement.
          const goodDirection = indicator.target?.direction === "min" ? "down" : "up";
          const trendIsGood = trend != null && trend === goodDirection;
          return (
            <div
              key={indicator.id}
              className="rounded-field border border-base-content/8 bg-base-200/30 p-3"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-base-content/50">
                <span style={{ color: accent }}>
                  <Icon size={12} strokeWidth={2.2} />
                </span>
                <span className="line-clamp-1" title={indicator.shortName ?? indicator.name}>
                  {indicator.shortName ?? indicator.name}
                </span>
              </div>
              <div className="mt-1.5 flex items-end justify-between gap-1">
                <span
                  className={
                    result.note
                      ? "line-clamp-1 text-xs font-medium text-base-content/60"
                      : "stat-figure-num text-lg font-bold text-base-content"
                  }
                  title={result.note ?? undefined}
                >
                  {result.note ?? (result.pct == null ? "-" : `${result.pct.toFixed(indicator.decimals ?? 1)}%`)}
                </span>
                {trend && (
                  <span className={trendIsGood ? "text-success" : "text-error"} title={trend === "up" ? "เพิ่มขึ้นจากเดือนก่อน" : "ลดลงจากเดือนก่อน"}>
                    {trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </span>
                )}
              </div>
              {status ? (
                <div
                  className={`mt-1.5 flex w-fit items-center gap-1 rounded-field px-1.5 py-0.5 text-[10px] font-semibold ${
                    status === "pass" ? "bg-success/15 text-success" : "bg-error/15 text-error"
                  }`}
                >
                  {status === "pass" ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                  {status === "pass" ? "PASS" : "FAIL"}
                </div>
              ) : (
                <div className="mt-1.5 text-[10px] text-base-content/30">ไม่มีข้อมูล</div>
              )}
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
