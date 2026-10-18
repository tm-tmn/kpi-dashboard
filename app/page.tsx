"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { SERVICE_POINTS } from "@/lib/constants";
import {
  RecordRow, availableFiscalYears, fiscalYearByPoint, fiscalYearByType,
  fiscalMonthLabels, yearlyTrend,
} from "@/lib/aggregate";

const COLORS = ["#2563eb", "#059669", "#d946ef", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6"];

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
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

  const grandTotal = byPoint.reduce((s, p) => s + p.total, 0);

  const monthlyChartData = monthLabels.map((label, i) => {
    const row: Record<string, string | number> = { month: label };
    for (const p of byPoint) row[p.point] = p.values[i];
    return row;
  });

  const trendChartData = trend.map((t) => ({ year: t.year, total: t.total }));

  if (loading) {
    return <main className="p-8 text-slate-500 text-sm">กำลังโหลดข้อมูล...</main>;
  }
  if (error) {
    return (
      <main className="p-8 text-sm text-red-600">
        โหลดข้อมูลไม่สำเร็จ: {error}
        <div className="mt-2 text-slate-500">
          ตรวจสอบว่าได้ตั้งค่า GOOGLE_SHEET_ID และ service account env vars แล้ว
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            สถิติงานบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
          </h1>
          <p className="mt-1 text-sm text-slate-500">โรงพยาบาลศรีนครินทร์</p>
        </div>
        <Link
          href="/entry"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
        >
          + กรอกข้อมูลเดือนใหม่
        </Link>
      </div>

      {years.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">ปีงบประมาณ</label>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            value={fiscalYear ?? ""}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {years.length === 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          ยังไม่มีข้อมูลในชีต &quot;ข้อมูลดิบ&quot; — เริ่มกรอกได้ที่หน้า{" "}
          <Link href="/entry" className="underline">กรอกข้อมูล</Link>
        </div>
      )}

      {years.length > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card title={`จำนวนผู้รับบริการทั้งหมด (ปีงบ ${fiscalYear})`} value={grandTotal.toLocaleString()} />
            {byPoint.map((p) => (
              <Card key={p.point} title={p.point} value={p.total.toLocaleString()} />
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              จำนวนผู้รับบริการรายเดือน แยกตามจุดบริการ (ปีงบ {fiscalYear})
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {SERVICE_POINTS.map((p, i) => (
                  <Bar key={p} dataKey={p} stackId="a" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {SERVICE_POINTS.map((point) => {
              const data = fiscalYearByType(records, fiscalYear!, point);
              if (!data.length) return null;
              return (
                <div key={point} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-semibold text-slate-600">{point}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey="total"
                        nameKey="type"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {data.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">แนวโน้มยอดผู้รับบริการรายปี</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trendChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1 text-left">ปี</th>
              <th className="py-1 text-right">รวม</th>
              <th className="py-1 text-right">% เปลี่ยนแปลง</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.year} className="border-b border-slate-100">
                <td className="py-1">{t.year}</td>
                <td className="py-1 text-right">{t.total.toLocaleString()}</td>
                <td className={`py-1 text-right ${t.pctChange != null && t.pctChange < 0 ? "text-red-500" : "text-emerald-600"}`}>
                  {t.pctChange == null ? "-" : `${t.pctChange.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">
          ปี 2563-2568: ยอดรวมจากไฟล์เดิม (ไม่แยกจุดบริการ) · ปี 2569 เป็นต้นไป: คำนวณจากข้อมูลที่กรอกจริง
        </p>
      </div>
    </main>
  );
}
