"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area, ReferenceLine,
} from "recharts";
import {
  KeyRound, TrendingUp, TrendingDown, Users, CalendarClock, Droplet, Timer, ShieldCheck,
  CheckCircle2, XCircle, Wrench, Smile, MessageSquareWarning,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SERVICE_POINTS, TAT_STAGES, TAT_STAGE_META, KPI_INDICATORS, MONTH_NAMES_TH, fiscalYearMonths } from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import {
  RecordRow, availableFiscalYears, fiscalYearByPoint, fiscalYearByType,
  fiscalMonthLabels, yearlyTrend, monthByPoint, monthByType,
} from "@/lib/aggregate";
import {
  TatRecordRow, availableTatYears, tatSeriesByPoint, tatMonthLabels, tatByPointForMonth,
} from "@/lib/aggregate-tat";
import {
  KpiRecordRow, kpiMonthResult, kpiYearTrend, kpiStatus,
} from "@/lib/aggregate-kpi";
import { CountUp } from "@/components/CountUp";
import { BentoCard } from "@/components/BentoCard";
import { StatusBanner } from "@/components/StatusBanner";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LiveClock } from "@/components/LiveClock";
import { ExecutiveSummary } from "@/components/ExecutiveSummary";
import { TypeTatCorrelation } from "@/components/TypeTatCorrelation";
import { useTheme } from "@/lib/useTheme";

// Ranked horizontal bar list — replaces the old per-point pie/donut for
// "share by ประเภทผู้รับบริการ". A pie's slice labels collide once there
// are 4+ categories with long Thai names; a bar list has room for the full
// label, the raw count, and the % side by side, with no overlap risk.
function TypeBreakdownBars({
  data, palette,
}: { data: { type: string; total: number }[]; palette: string[] }) {
  const total = data.reduce((s, d) => s + d.total, 0);
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = total > 0 ? (d.total / total) * 100 : 0;
        const widthPct = (d.total / max) * 100;
        const color = palette[i % palette.length];
        return (
          <div key={d.type} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
              <span className="truncate text-xs text-base-content/60" title={d.type}>{d.type}</span>
            </div>
            <div className="stat-figure-num w-14 shrink-0 text-right text-xs text-base-content/70">
              {d.total.toLocaleString()}
            </div>
            <div className="w-10 shrink-0 text-right text-[11px] font-semibold" style={{ color }}>
              {pct.toFixed(0)}%
            </div>
            <div className="col-span-3 h-1.5 overflow-hidden rounded-full bg-base-content/6">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${widthPct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Decorative icon + a fixed categorical accent per quality indicator — never
// a status color (success/error already carry the PASS/FAIL meaning on the
// badge next to it, so this stays purely identity, not state).
const KPI_ICON_META: Record<string, LucideIcon> = {
  rejection: XCircle,
  pm: Wrench,
  tat30: Timer,
  satisfaction: Smile,
  complaint: MessageSquareWarning,
  safety: ShieldCheck,
};
const KPI_ACCENTS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-info)",
  "var(--color-primary)",
  "var(--color-secondary)",
];

// A shared 0–100 y-axis reads consistently across cards, but it also
// flattens any indicator whose real values and target both sit near one end
// of that range (e.g. rejection rate ≤0.5%, or PM/complaint/TAT30/satisfaction
// clustered near their 90–100% target) into what looks like a flat line —
// the variance that actually matters is too small a fraction of 100 to see.
// Zooming the axis to the data + target (with a dashed target reference line
// so the threshold stays visible) keeps the chart honest while making real
// month-to-month movement legible.
function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function zoomedPercentAxis(values: (number | null | undefined)[], target?: number) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return { domain: [0, 100] as [number, number], ticks: undefined, targetInRange: false };
  const dataMin = Math.min(...nums);
  const dataMax = Math.max(...nums);
  const dataSpan = Math.max(dataMax - dataMin, dataMax * 0.1, 1);

  // Fold the target into the zoomed range only if it's reasonably close to
  // the real data (within ~2x the data's own spread). A target far outside
  // the actual variance — satisfaction's 30% floor when real scores run
  // 75-85%, say — would otherwise blow the zoom back out to the same wide,
  // flat-looking range this is meant to fix. When that happens the target
  // is shown as a badge next to the chart title instead of a line on it.
  let lo = dataMin;
  let hi = dataMax;
  let targetInRange = target == null;
  if (target != null) {
    const distOutside = target < dataMin ? dataMin - target : target > dataMax ? target - dataMax : 0;
    if (distOutside <= dataSpan * 2) {
      lo = Math.min(lo, target);
      hi = Math.max(hi, target);
      targetInRange = true;
    }
  }

  const span = Math.max(hi - lo, hi * 0.1, 1);
  const step = niceStep(span / 4);
  const loF = Math.max(0, Math.floor((lo - span * 0.25) / step) * step);
  let hiF = Math.min(100, Math.ceil((hi + span * 0.25) / step) * step);
  if (hiF <= loF) hiF = Math.min(100, loF + step);
  const ticks: number[] = [];
  for (let v = loF; v <= hiF + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [loF, hiF] as [number, number], ticks, targetInRange };
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton h-36 rounded-box bg-base-200/60" />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { mode } = useTheme();
  const isLight = mode === "light";
  // Recharts needs plain color strings (not CSS vars) for tooltip/axis/grid,
  // so the dark/light pair lives here instead of in globals.css.
  const chartColors = useMemo(
    () => ({
      tooltip: {
        background: isLight ? "#FFFFFF" : "#0F1524",
        border: isLight ? "1px solid rgba(15,21,36,0.08)" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        fontSize: 12,
        color: isLight ? "#1A2033" : "#E7EAF3",
      },
      axisTick: isLight ? "#64748B" : "#8C98B8",
      grid: isLight ? "rgba(15,21,36,0.09)" : "rgba(255,255,255,0.06)",
      cursor: isLight ? "rgba(15,21,36,0.05)" : "rgba(255,255,255,0.04)",
    }),
    [isLight]
  );

  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);
  const [showYoY, setShowYoY] = useState(true);
  // "all" = whole fiscal year (default); a number 0..11 = one fiscal-order
  // month index (0 = ต.ค., 11 = ก.ย.) to drill the dashboard into.
  const [monthIndex, setMonthIndex] = useState<number | "all">("all");

  const [tatRecords, setTatRecords] = useState<TatRecordRow[]>([]);
  const [tatYear, setTatYear] = useState<number | null>(null);
  const [tatError, setTatError] = useState<string | null>(null);

  const [kpiRecords, setKpiRecords] = useState<KpiRecordRow[]>([]);
  const [kpiError, setKpiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((data: { records?: RecordRow[]; error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setRecords(data.records ?? []);
        const years = availableFiscalYears(data.records ?? []);
        if (years.length) setFiscalYear(years[years.length - 1]);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));

    fetch("/api/tat")
      .then((r) => r.json())
      .then((data: { records?: TatRecordRow[]; error?: string }) => {
        if (data.error) { setTatError(data.error); return; }
        setTatRecords(data.records ?? []);
        const years = availableTatYears(data.records ?? []);
        if (years.length) setTatYear(years[years.length - 1]);
      })
      .catch((e) => setTatError(String(e)));

    fetch("/api/kpi")
      .then((r) => r.json())
      .then((data: { records?: KpiRecordRow[]; error?: string }) => {
        if (data.error) { setKpiError(data.error); return; }
        setKpiRecords(data.records ?? []);
      })
      .catch((e) => setKpiError(String(e)));
  }, []);

  const years = useMemo(() => availableFiscalYears(records), [records]);
  const byPoint = useMemo(
    () => (fiscalYear ? fiscalYearByPoint(records, fiscalYear, SERVICE_POINTS) : []),
    [records, fiscalYear]
  );
  const monthLabels = fiscalMonthLabels();
  const trend = useMemo(() => yearlyTrend(records), [records]);
  const latestTrend = trend[trend.length - 1];

  // The actual (ปี, เดือน) the month selector points at, in fiscal order —
  // null when the selector is on "ทั้งปี" (whole fiscal year).
  const selectedMonthPair = useMemo(() => {
    if (!fiscalYear || monthIndex === "all") return null;
    return fiscalYearMonths(fiscalYear)[monthIndex] ?? null;
  }, [fiscalYear, monthIndex]);

  // Per-จุดบริการ totals scoped to the selector: whole fiscal year by
  // default, or a single month when one is picked.
  const displayByPoint = useMemo(() => {
    if (selectedMonthPair) return monthByPoint(records, selectedMonthPair.year, selectedMonthPair.month, SERVICE_POINTS);
    return byPoint;
  }, [records, selectedMonthPair, byPoint]);

  const grandTotal = displayByPoint.reduce((s, p) => s + p.total, 0);

  const scopeLabel = selectedMonthPair
    ? `เดือน ${MONTH_NAMES_TH[selectedMonthPair.month - 1]} ${selectedMonthPair.year}`
    : `ปีงบ ${fiscalYear}`;

  const monthlyChartData = monthLabels.map((label, i) => {
    const row: Record<string, string | number> = { month: label };
    for (const p of byPoint) row[p.point] = p.values[i];
    return row;
  });

  const sparklineData = trend.slice(-6).map((t) => ({ year: t.year, total: t.total }));
  const trendChartData = trend.map((t) => ({ year: String(t.year), total: t.total }));

  const tatYears = useMemo(() => availableTatYears(tatRecords), [tatRecords]);
  const tatMonths = tatMonthLabels();
  const tatChartDataByPoint = useMemo(() => {
    if (!tatYear) return [];
    return SERVICE_POINTS.map((point) => {
      const series = tatSeriesByPoint(tatRecords, tatYear, point);
      const data = tatMonths.map((label, i) => {
        const row: Record<string, string | number | null> = { month: label };
        for (const s of series) row[s.stage] = s.values[i];
        return row;
      });
      return { point, data };
    });
  }, [tatRecords, tatYear, tatMonths]);

  // Side-by-side point comparison: the latest month (within the selected
  // TAT year) that has any data at all, across every จุดบริการ at once —
  // the "all 4 points in one view" complement to the per-point trend
  // charts above, which only show one point's history at a time.
  const tatCompare = useMemo(() => {
    if (!tatYear) return { month: null as number | null, rows: [] as ReturnType<typeof tatByPointForMonth> };
    const monthsWithData = tatRecords.filter((r) => r.year === tatYear).map((r) => r.month);
    if (!monthsWithData.length) return { month: null, rows: [] };
    const month = Math.max(...monthsWithData);
    return { month, rows: tatByPointForMonth(tatRecords, tatYear, month, SERVICE_POINTS, TAT_STAGES) };
  }, [tatRecords, tatYear]);

  // Fastest/slowest by the "รวมทั้งหมด" stage, to call out at a glance —
  // only meaningful once at least 2 points have that stage filled in.
  const tatCompareRanked = useMemo(() => {
    const totalStage = TAT_STAGES[3];
    const withTotal = tatCompare.rows
      .map((r) => ({ point: r.point as string, total: r[totalStage] as number | null }))
      .filter((r): r is { point: string; total: number } => r.total != null);
    if (withTotal.length < 2) return null;
    const sorted = [...withTotal].sort((a, b) => a.total - b.total);
    return { fastest: sorted[0], slowest: sorted[sorted.length - 1] };
  }, [tatCompare]);

  // Latest (year, month) that has any KPI row, so the score tiles show the
  // most recently filled-in month rather than requiring another selector.
  const kpiLatestMonth = useMemo(() => {
    if (!kpiRecords.length) return null;
    return kpiRecords.reduce(
      (latest, r) => {
        const key = r.year * 12 + r.month;
        return key > latest.key ? { key, year: r.year, month: r.month } : latest;
      },
      { key: -Infinity, year: 0, month: 0 }
    );
  }, [kpiRecords]);

  const kpiResults = useMemo(() => {
    if (!kpiLatestMonth) return [];
    return KPI_INDICATORS.map((indicator) => ({
      indicator,
      result: kpiMonthResult(indicator, kpiRecords, records, kpiLatestMonth.year, kpiLatestMonth.month),
    }));
  }, [kpiRecords, records, kpiLatestMonth]);

  // The single most actionable thing a dashboard viewer wants surfaced
  // immediately: which quality indicators missed this month's target.
  const failedKpis = useMemo(
    () => kpiResults.filter((r) => kpiStatus(r.indicator, r.result) === "fail"),
    [kpiResults]
  );

  // The (year, month) immediately before kpiLatestMonth, so the executive
  // summary can show a month-over-month trend arrow per indicator.
  const kpiPrevMonthPair = useMemo(() => {
    if (!kpiLatestMonth) return null;
    const month = kpiLatestMonth.month === 1 ? 12 : kpiLatestMonth.month - 1;
    const year = kpiLatestMonth.month === 1 ? kpiLatestMonth.year - 1 : kpiLatestMonth.year;
    return { year, month };
  }, [kpiLatestMonth]);

  // One-page-glance summary: PASS/FAIL per indicator (evaluated against its
  // own target, direction-aware) plus a trend arrow vs. last month.
  const executiveSummary = useMemo(() => {
    if (!kpiLatestMonth) return [];
    return kpiResults.map(({ indicator, result }) => {
      const prevResult = kpiPrevMonthPair
        ? kpiMonthResult(indicator, kpiRecords, records, kpiPrevMonthPair.year, kpiPrevMonthPair.month)
        : null;
      const status = kpiStatus(indicator, result);
      let trend: "up" | "down" | null = null;
      if (result.pct != null && prevResult?.pct != null && result.pct !== prevResult.pct) {
        trend = result.pct > prevResult.pct ? "up" : "down";
      }
      return { indicator, result, status, trend };
    });
  }, [kpiResults, kpiLatestMonth, kpiPrevMonthPair, kpiRecords, records]);

  // Each indicator's own-year trend, plus the prior fiscal year's same 12
  // months merged in alongside it (by month position — both start in
  // October) so the chart can draw a dashed "last year" line next to this
  // year's for an at-a-glance YoY comparison.
  const kpiTrendByIndicator = useMemo(() => {
    if (!fiscalYear) return [];
    return KPI_INDICATORS.map((indicator) => {
      const current = kpiYearTrend(indicator, kpiRecords, records, fiscalYear);
      const prev = kpiYearTrend(indicator, kpiRecords, records, fiscalYear - 1);
      const hasPrevData = prev.some((d) => d.pct != null);
      const data = current.map((d, i) => ({ ...d, pctPrev: prev[i]?.pct ?? null }));
      return { indicator, data, hasPrevData };
    });
  }, [kpiRecords, records, fiscalYear]);

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="space-y-6">
        <div className="skeleton h-10 w-72 rounded-field bg-base-200/60" />
        <Skeleton />
      </div>
    );
  } else if (error) {
    content = (
      <StatusBanner
        type="error"
        title="โหลดข้อมูลไม่สำเร็จ"
        message={
          <>
            {error}
            <div className="mt-2 text-xs opacity-75">
              ตรวจสอบว่าได้ตั้งค่า GOOGLE_SHEET_ID และ service account env vars แล้ว
            </div>
          </>
        }
      />
    );
  } else {
    content = (
    <div className="space-y-6 pb-16">
      {failedKpis.length > 0 && (
        <StatusBanner
          type="warning"
          title={`ตัวชี้วัดคุณภาพไม่ผ่านเกณฑ์ ${failedKpis.length} รายการ · ${MONTH_NAMES_TH[(kpiLatestMonth?.month ?? 1) - 1]} ${kpiLatestMonth?.year}`}
          message={failedKpis.map((k) => k.indicator.shortName ?? k.indicator.name).join(" · ")}
        />
      )}

      {kpiLatestMonth && (
        <ExecutiveSummary
          items={executiveSummary}
          icons={KPI_ICON_META}
          accents={KPI_ACCENTS}
          monthLabel={`${MONTH_NAMES_TH[kpiLatestMonth.month - 1]} ${kpiLatestMonth.year}`}
        />
      )}

      {years.length === 0 && (
        <StatusBanner
          type="info"
          message={
            <>
              ยังไม่มีข้อมูลในชีต &quot;ข้อมูลดิบ&quot; — เริ่มกรอกได้ที่หน้า{" "}
              <Link href="/entry" className="link link-primary">กรอกข้อมูล</Link>
            </>
          }
        />
      )}

      {years.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-base-content/40">
              ปีงบประมาณ
            </span>
            <select
              className="select select-sm select-bordered w-28 bg-base-200/60"
              value={fiscalYear ?? ""}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-xs font-medium uppercase tracking-wide text-base-content/40">
              เดือน
            </span>
            <select
              className="select select-sm select-bordered w-32 bg-base-200/60"
              value={monthIndex}
              onChange={(e) => setMonthIndex(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">ทั้งปี</option>
              {monthLabels.map((label, i) => (
                <option key={label} value={i}>{label}</option>
              ))}
            </select>
          </div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:[grid-auto-flow:dense]">
            {/* Hero */}
            <BentoCard i={0} className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium text-base-content/50">
                      <Users size={14} />
                      จำนวนผู้รับบริการทั้งหมด · {scopeLabel}
                    </div>
                    <div className="mt-3 text-4xl font-bold text-base-content sm:text-5xl">
                      <CountUp value={grandTotal} />
                      <span className="ml-2 text-base font-medium text-base-content/40">คน</span>
                    </div>
                  </div>
                  {!selectedMonthPair && latestTrend?.pctChange != null && (
                    <div
                      className={`badge gap-1 border-0 ${
                        latestTrend.pctChange >= 0
                          ? "bg-success/15 text-success"
                          : "bg-error/15 text-error"
                      }`}
                    >
                      {latestTrend.pctChange >= 0 ? (
                        <TrendingUp size={13} />
                      ) : (
                        <TrendingDown size={13} />
                      )}
                      {Math.abs(latestTrend.pctChange).toFixed(1)}%
                    </div>
                  )}
                </div>

                <div className="mt-6 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparklineData}>
                      <defs>
                        <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-opd)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-opd)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={chartColors.tooltip} labelStyle={{ color: chartColors.tooltip.color }} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="var(--color-opd)"
                        strokeWidth={2}
                        fill="url(#heroGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 text-xs text-base-content/40">แนวโน้ม 6 ปีล่าสุด</div>
              </div>
            </BentoCard>

            {/* Per-point mini stats */}
            {displayByPoint.map((p, idx) => {
              const meta = pointMeta(p.point);
              const Icon = meta.icon;
              const pct = grandTotal > 0 ? (p.total / grandTotal) * 100 : 0;
              return (
                <BentoCard key={p.point} i={idx + 1}>
                  <div className="flex items-center justify-between">
                    <span
                      className="icon-badge flex h-9 w-9 items-center justify-center rounded-field"
                      style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.color }}
                    >
                      <Icon size={17} strokeWidth={2.2} />
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-base-content">
                      <CountUp value={p.total} />
                    </span>
                    <span className="stat-figure-num text-xs font-semibold" style={{ color: meta.color }}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-base-content/70">{p.point}</div>
                </BentoCard>
              );
            })}
          </div>

          {/* Monthly stacked bar */}
          <BentoCard i={5} className="!p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-base-content">
                จำนวนผู้รับบริการรายเดือน แยกตามจุดบริการ
              </h2>
              <span className="text-xs text-base-content/40">ปีงบ {fiscalYear}</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyChartData} barCategoryGap={18} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartColors.tooltip} cursor={{ fill: chartColors.cursor }} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axisTick }} />
                {SERVICE_POINTS.map((p, pIdx) => (
                  <Bar
                    key={p}
                    dataKey={p}
                    stackId="a"
                    fill={pointMeta(p).color}
                    radius={pIdx === SERVICE_POINTS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  >
                    {monthlyChartData.map((_, i) => (
                      <Cell key={i} fillOpacity={monthIndex === "all" || monthIndex === i ? 1 : 0.25} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </BentoCard>

          {/* Share by ประเภทผู้รับบริการ, per จุดบริการ — ranked bar list */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {SERVICE_POINTS.map((point, idx) => {
              const data = selectedMonthPair
                ? monthByType(records, selectedMonthPair.year, selectedMonthPair.month, point)
                : fiscalYearByType(records, fiscalYear!, point);
              if (!data.length) return null;
              const meta = pointMeta(point);
              return (
                <BentoCard key={point} i={6 + idx} className="!p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-base-content/70">
                      <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                      {point}
                    </h3>
                    <span className="text-[11px] text-base-content/35">{scopeLabel}</span>
                  </div>
                  <TypeBreakdownBars data={data} palette={meta.palette} />
                </BentoCard>
              );
            })}
          </div>
        </>
      )}

      {/* Yearly trend */}
      <BentoCard i={9} className="!p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="icon-badge flex h-7 w-7 items-center justify-center rounded-field bg-primary/15 text-primary">
            <CalendarClock size={14} strokeWidth={2.2} />
          </span>
          <h2 className="text-sm font-semibold text-base-content">แนวโน้มยอดผู้รับบริการรายปี</h2>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={chartColors.tooltip} />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--color-opd)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "var(--color-opd)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-base-content/8 text-base-content/40">
                <th className="py-1.5 text-left font-medium">ปี</th>
                <th className="py-1.5 text-right font-medium">รวม</th>
                <th className="py-1.5 text-right font-medium">% เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => (
                <tr key={t.year} className="border-b border-base-content/5">
                  <td className="py-1.5 text-base-content/70">{t.year}</td>
                  <td className="stat-figure-num py-1.5 text-right text-base-content/90">
                    {t.total.toLocaleString()}
                  </td>
                  <td
                    className={`py-1.5 text-right ${
                      t.pctChange != null && t.pctChange < 0 ? "text-error" : "text-success"
                    }`}
                  >
                    {t.pctChange == null ? "-" : `${t.pctChange.toFixed(1)}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-base-content/35">
          ปี 2563-2568: ยอดรวมจากไฟล์เดิม (ไม่แยกจุดบริการ) · ปี 2569 เป็นต้นไป: คำนวณจากข้อมูลที่กรอกจริง
        </p>
      </BentoCard>

      {/* TAT section */}
      {tatError ? (
        <StatusBanner type="error" title="โหลดข้อมูล TAT ไม่สำเร็จ" message={tatError} className="mt-8" />
      ) : tatYears.length > 0 && tatYear ? (
        <>
          <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="icon-badge flex h-7 w-7 items-center justify-center rounded-field bg-accent/15 text-accent">
                <Timer size={14} strokeWidth={2.2} />
              </span>
              <h2 className="text-sm font-semibold text-base-content">
                ระยะเวลาการให้บริการเฉลี่ย (TAT) ช่วงเวลา 6.00-9.00 น.
              </h2>
            </div>
            <select
              className="select select-sm select-bordered w-28 bg-base-200/60"
              value={tatYear}
              onChange={(e) => setTatYear(Number(e.target.value))}
            >
              {tatYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Side-by-side point comparison — all 4 จุดบริการ in one chart,
              instead of needing to look at one point's history at a time
              further down. */}
          {tatCompare.month && (
            <BentoCard i={10} className="mb-4 !p-5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-base-content">
                  เปรียบเทียบ 4 จุดบริการ
                </h3>
                <span className="text-xs text-base-content/40">
                  {tatMonths[tatCompare.month - 1]} {tatYear}
                </span>
              </div>
              {tatCompareRanked && (
                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded-field bg-success/15 px-2 py-1 text-success">
                    <Timer size={11} /> เร็วสุด {pointMeta(tatCompareRanked.fastest.point).short} ·{" "}
                    {tatCompareRanked.fastest.total.toFixed(1)} น.
                  </span>
                  <span className="flex items-center gap-1.5 rounded-field bg-error/15 px-2 py-1 text-error">
                    <Timer size={11} /> ช้าสุด {pointMeta(tatCompareRanked.slowest.point).short} ·{" "}
                    {tatCompareRanked.slowest.total.toFixed(1)} น.
                  </span>
                </div>
              )}
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={tatCompare.rows} barCategoryGap={28} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis
                    dataKey="point"
                    tickFormatter={(point: string) => pointMeta(point).short}
                    tick={{ fontSize: 11, fill: chartColors.axisTick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: chartColors.axisTick }} axisLine={false} tickLine={false} unit="น." />
                  <Tooltip
                    contentStyle={chartColors.tooltip}
                    formatter={(value, name) => [value == null ? "ไม่มีข้อมูล" : `${Number(value).toFixed(1)} นาที`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: chartColors.axisTick }} />
                  {TAT_STAGES.map((stage) => {
                    const sMeta = TAT_STAGE_META[stage];
                    return (
                      <Bar
                        key={stage}
                        dataKey={stage}
                        name={sMeta.short}
                        fill={sMeta.color}
                        fillOpacity={sMeta.total ? 1 : 0.65}
                        radius={[3, 3, 0, 0]}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>
            </BentoCard>
          )}

          <div className="mb-3 text-xs font-medium text-base-content/40">รายละเอียดแนวโน้มแต่ละจุดบริการ</div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {tatChartDataByPoint.map(({ point, data }, idx) => {
              const meta = pointMeta(point);
              return (
                <BentoCard key={point} i={11 + idx} className="!p-5">
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-base-content">
                    <span style={{ color: meta.color }}>{meta.short}</span>
                    <span className="text-xs font-normal text-base-content/40">{point}</span>
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: chartColors.axisTick }} axisLine={false} tickLine={false} unit="น." />
                      <Tooltip
                        contentStyle={chartColors.tooltip}
                        formatter={(value, name) => [`${Number(value).toFixed(1)} นาที`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: chartColors.axisTick }} />
                      {Object.entries(TAT_STAGE_META).map(([stage, sMeta]) => (
                        <Line
                          key={stage}
                          type="monotone"
                          dataKey={stage}
                          name={sMeta.short}
                          stroke={sMeta.color}
                          strokeWidth={sMeta.total ? 2.75 : 1.75}
                          dot={{ r: 3, strokeWidth: 0, fill: sMeta.color }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </BentoCard>
              );
            })}
          </div>

          <div className="mt-4">
            <TypeTatCorrelation attendance={records} tatRecords={tatRecords} chartColors={chartColors} i={15} />
          </div>
        </>
      ) : (
        <StatusBanner
          type="info"
          className="mt-8"
          message={
            <>
              ยังไม่มีข้อมูล TAT — เริ่มกรอกได้ที่หน้า{" "}
              <Link href="/entry" className="link link-primary">กรอกข้อมูล</Link>
            </>
          }
        />
      )}

      {/* KPI / quality-indicators section */}
      {kpiError ? (
        <StatusBanner type="error" title="โหลดข้อมูลตัวชี้วัดคุณภาพไม่สำเร็จ" message={kpiError} className="mt-8" />
      ) : kpiLatestMonth ? (
        <>
          <div className="mb-4 mt-8 flex items-center gap-2">
            <span className="icon-badge flex h-7 w-7 items-center justify-center rounded-field bg-success/15 text-success">
              <ShieldCheck size={14} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold text-base-content">
              ตัวชี้วัดคุณภาพหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
            </h2>
            <span className="text-xs text-base-content/40">
              · ล่าสุด {MONTH_NAMES_TH[kpiLatestMonth.month - 1]} {kpiLatestMonth.year}
            </span>
          </div>

          {/* Score tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {kpiResults.map(({ indicator, result }, idx) => {
              const Icon = KPI_ICON_META[indicator.id] ?? ShieldCheck;
              const accent = KPI_ACCENTS[idx % KPI_ACCENTS.length];
              return (
              <BentoCard key={indicator.id} i={17 + idx} className="!p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="icon-badge mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-field"
                      style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
                    >
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                    <h3 className="text-sm font-semibold text-base-content">{indicator.shortName ?? indicator.name}</h3>
                  </div>
                  {result.status && (
                    <span
                      className={`flex items-center gap-1 rounded-field px-2 py-0.5 text-[11px] font-semibold ${
                        result.status === "pass" ? "bg-success/15 text-success" : "bg-error/15 text-error"
                      }`}
                    >
                      {result.status === "pass" ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {result.status === "pass" ? "PASS" : "FAIL"}
                    </span>
                  )}
                </div>
                <div className={result.note ? "mt-3 text-lg font-semibold text-base-content/60" : "mt-3 stat-figure-num text-3xl font-bold text-base-content"}>
                  {result.note ?? (result.pct == null ? "-" : `${result.pct.toFixed(indicator.decimals ?? 1)}%`)}
                </div>
                {result.detail.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-base-content/8 pt-2">
                    {result.detail.map((d) => (
                      <div key={d.label} className="flex items-center justify-between text-xs">
                        <span className="text-base-content/50">{d.label}</span>
                        <span
                          className={
                            d.status === "fail"
                              ? "text-error"
                              : d.status === "pass"
                                ? "text-success"
                                : "text-base-content/50"
                          }
                        >
                          {d.status === "pending" ? "รอทำสัญญา" : d.pct == null ? "-" : `${d.pct.toFixed(indicator.decimals ?? 1)}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </BentoCard>
              );
            })}
          </div>

          {/* Trend lines — a PASS/FAIL indicator (safety) is a status, not a
              continuous quantity, so charting it as a 0–100 line that dips on
              every incident reads as noise; it gets a month-by-month status
              strip instead. The rest stay % line charts, each zoomed to its
              own data + target (not a shared 0–100 axis) — several of these
              indicators naturally sit within a few points of their target
              (rejection ≤0.5%, PM/complaint/TAT30 near 90–100%), and a full
              0–100 scale buries that real movement. A dashed target line
              keeps the zoomed axis honest about where "pass" actually is. */}
          <div className="mb-3 mt-4 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-base-content/50">แนวโน้มรายตัวชี้วัด</h3>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-base-content/60">
              <input
                type="checkbox"
                className="toggle toggle-xs toggle-primary"
                checked={showYoY}
                onChange={(e) => setShowYoY(e.target.checked)}
              />
              เทียบปีงบก่อนหน้า (YoY)
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {kpiTrendByIndicator.map(({ indicator, data, hasPrevData }, idx) => {
              const showPrev = showYoY && hasPrevData;
              const axis = zoomedPercentAxis(
                showPrev ? data.flatMap((d) => [d.pct, d.pctPrev]) : data.map((d) => d.pct),
                indicator.target?.value
              );
              return (
              <BentoCard key={indicator.id} i={23 + idx} className="!p-5">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <h3 className="text-xs font-semibold text-base-content/70">{indicator.shortName ?? indicator.name}</h3>
                  {indicator.target && !axis.targetInRange && (
                    <span className="shrink-0 text-[10px] text-base-content/35">
                      เป้าหมาย {indicator.target.value}%
                    </span>
                  )}
                </div>
                {indicator.kind === "incident" ? (
                  <div className="flex h-[180px] flex-col justify-center gap-2">
                    <div className="grid grid-cols-12 gap-1.5">
                      {data.map((d, i) => (
                        <div
                          key={i}
                          title={`${d.month}: ${d.status === "pass" ? "PASS" : d.status === "fail" ? "FAIL" : "ไม่มีข้อมูล"}`}
                          className={`flex h-9 items-center justify-center rounded-field ${
                            d.status === "pass"
                              ? "bg-success/15 text-success"
                              : d.status === "fail"
                                ? "bg-error/15 text-error"
                                : "bg-base-200/50 text-base-content/25"
                          }`}
                        >
                          {d.status === "pass" ? (
                            <CheckCircle2 size={14} />
                          ) : d.status === "fail" ? (
                            <XCircle size={14} />
                          ) : (
                            <span className="text-[10px]">–</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-12 gap-1.5">
                      {data.map((d, i) => (
                        <span key={i} className="text-center text-[9px] text-base-content/35">{d.month}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: chartColors.axisTick }} axisLine={false} tickLine={false} />
                      <YAxis
                        domain={axis.domain}
                        ticks={axis.ticks}
                        tick={{ fontSize: 11, fill: chartColors.axisTick }}
                        axisLine={false}
                        tickLine={false}
                        unit="%"
                      />
                      <Tooltip
                        contentStyle={chartColors.tooltip}
                        formatter={(value, name) => [`${Number(value).toFixed(indicator.decimals ?? 1)}%`, name]}
                      />
                      {showPrev && (
                        <Legend wrapperStyle={{ fontSize: 10, color: chartColors.axisTick }} />
                      )}
                      {indicator.target && axis.targetInRange && (
                        <ReferenceLine
                          y={indicator.target.value}
                          stroke={chartColors.axisTick}
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                          label={{
                            value: `เป้าหมาย ${indicator.target.value}%`,
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: chartColors.axisTick,
                          }}
                        />
                      )}
                      {showPrev && (
                        <Line
                          type="monotone"
                          dataKey="pctPrev"
                          name={`ปีงบ ${(fiscalYear ?? 0) - 1}`}
                          stroke={chartColors.axisTick}
                          strokeWidth={1.75}
                          strokeDasharray="5 5"
                          dot={false}
                          connectNulls
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="pct"
                        name={showPrev ? `ปีงบ ${fiscalYear}` : (indicator.shortName ?? indicator.name)}
                        stroke="var(--color-opd)"
                        strokeWidth={2.25}
                        dot={{ r: 3, strokeWidth: 0, fill: "var(--color-opd)" }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </BentoCard>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-base-content/35">
            เกณฑ์ประเมินของแต่ละตัวชี้วัดเป็นค่าเริ่มต้น — ปรับข้อความเกณฑ์จริงได้ที่หน้ากรอกข้อมูล (ตัวชี้วัดคุณภาพ)
          </p>
        </>
      ) : (
        <StatusBanner
          type="info"
          className="mt-8"
          message={
            <>
              ยังไม่มีข้อมูลตัวชี้วัดคุณภาพ — เริ่มกรอกได้ที่หน้า{" "}
              <Link href="/entry" className="link link-primary">กรอกข้อมูล</Link>
            </>
          }
        />
      )}
    </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="icon-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-field bg-error/15 text-error">
            <Droplet size={19} strokeWidth={2.4} fill="currentColor" fillOpacity={0.25} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-base-content sm:text-2xl">
              สถิติงานบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
            </h1>
            <p className="mt-1 text-sm text-base-content/50">โรงพยาบาลศรีนครินทร์</p>
            <LiveClock className="mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          <Link
            href="/entry"
            title="เข้าสู่ระบบกรอกข้อมูล"
            aria-label="เข้าสู่ระบบกรอกข้อมูล"
            className="btn btn-circle btn-ghost glass-panel border-0 text-base-content/60 hover:text-primary"
          >
            <KeyRound size={18} strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      {content}
    </div>
  );
}
