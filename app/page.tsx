"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, AreaChart, Area,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, Users, CalendarClock } from "lucide-react";
import { SERVICE_POINTS } from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import {
  RecordRow, availableFiscalYears, fiscalYearByPoint, fiscalYearByType,
  fiscalMonthLabels, yearlyTrend,
} from "@/lib/aggregate";
import { CountUp } from "@/components/CountUp";
import { BentoCard } from "@/components/BentoCard";

const TOOLTIP_STYLE = {
  background: "#0F1524",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#E7EAF3",
};

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
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fiscalYear, setFiscalYear] = useState<number | null>(null);

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
  }, []);

  const years = useMemo(() => availableFiscalYears(records), [records]);
  const byPoint = useMemo(
    () => (fiscalYear ? fiscalYearByPoint(records, fiscalYear, SERVICE_POINTS) : []),
    [records, fiscalYear]
  );
  const monthLabels = fiscalMonthLabels();
  const trend = useMemo(() => yearlyTrend(records), [records]);
  const latestTrend = trend[trend.length - 1];

  const grandTotal = byPoint.reduce((s, p) => s + p.total, 0);

  const monthlyChartData = monthLabels.map((label, i) => {
    const row: Record<string, string | number> = { month: label };
    for (const p of byPoint) row[p.point] = p.values[i];
    return row;
  });

  const sparklineData = trend.slice(-6).map((t) => ({ year: t.year, total: t.total }));
  const trendChartData = trend.map((t) => ({ year: String(t.year), total: t.total }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-72 rounded-field bg-base-200/60" />
        <Skeleton />
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-panel rounded-box p-6 text-sm">
        <div className="font-semibold text-error">โหลดข้อมูลไม่สำเร็จ</div>
        <div className="mt-1 text-base-content/60">{error}</div>
        <div className="mt-3 text-xs text-base-content/40">
          ตรวจสอบว่าได้ตั้งค่า GOOGLE_SHEET_ID และ service account env vars แล้ว
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-base-content sm:text-2xl">
            สถิติงานบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
          </h1>
          <p className="mt-1 text-sm text-base-content/50">โรงพยาบาลศรีนครินทร์</p>
        </div>
        <Link href="/entry" className="btn btn-primary gap-2 shadow-lg shadow-primary/20">
          <Plus size={16} />
          กรอกข้อมูลเดือนใหม่
        </Link>
      </div>

      {years.length === 0 && (
        <div className="glass-panel rounded-box p-6 text-sm text-base-content/70">
          ยังไม่มีข้อมูลในชีต &quot;ข้อมูลดิบ&quot; — เริ่มกรอกได้ที่หน้า{" "}
          <Link href="/entry" className="link link-primary">กรอกข้อมูล</Link>
        </div>
      )}

      {years.length > 0 && (
        <>
          <div className="flex items-center gap-3">
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
                      จำนวนผู้รับบริการทั้งหมด · ปีงบ {fiscalYear}
                    </div>
                    <div className="mt-3 text-4xl font-bold text-base-content sm:text-5xl">
                      <CountUp value={grandTotal} />
                      <span className="ml-2 text-base font-medium text-base-content/40">คน</span>
                    </div>
                  </div>
                  {latestTrend?.pctChange != null && (
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
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#E7EAF3" }} />
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
            {byPoint.map((p, idx) => {
              const meta = pointMeta(p.point);
              const Icon = meta.icon;
              return (
                <BentoCard key={p.point} i={idx + 1}>
                  <div className="flex items-center justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-field"
                      style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.color }}
                    >
                      <Icon size={17} strokeWidth={2.2} />
                    </span>
                    <span className="text-[11px] font-medium text-base-content/40">{meta.short}</span>
                  </div>
                  <div className="mt-4 text-2xl font-bold text-base-content">
                    <CountUp value={p.total} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-base-content/45">{p.point}</div>
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
              <BarChart data={monthlyChartData} barCategoryGap={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#8C98B8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#8C98B8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8C98B8" }} />
                {SERVICE_POINTS.map((p) => (
                  <Bar key={p} dataKey={p} stackId="a" fill={pointMeta(p).color} radius={[0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </BentoCard>

          {/* Donuts */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {SERVICE_POINTS.map((point, idx) => {
              const data = fiscalYearByType(records, fiscalYear!, point);
              if (!data.length) return null;
              const meta = pointMeta(point);
              return (
                <BentoCard key={point} i={6 + idx}>
                  <h3 className="mb-1 text-xs font-semibold text-base-content/70">{point}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="total"
                        nameKey="type"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {data.map((_, i) => (
                          <Cell key={i} fill={meta.palette[i % meta.palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#8C98B8" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </BentoCard>
              );
            })}
          </div>
        </>
      )}

      {/* Yearly trend */}
      <BentoCard i={9} className="!p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock size={16} className="text-base-content/40" />
          <h2 className="text-sm font-semibold text-base-content">แนวโน้มยอดผู้รับบริการรายปี</h2>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#8C98B8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#8C98B8" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
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
              <tr className="border-b border-white/8 text-base-content/40">
                <th className="py-1.5 text-left font-medium">ปี</th>
                <th className="py-1.5 text-right font-medium">รวม</th>
                <th className="py-1.5 text-right font-medium">% เปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => (
                <tr key={t.year} className="border-b border-white/5">
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
    </div>
  );
}
