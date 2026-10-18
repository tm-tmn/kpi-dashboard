"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PATIENT_TYPE_PAIRS,
  SERVICE_POINTS,
  MONTH_NAMES_TH,
  fiscalYearOf,
} from "@/lib/constants";

type RecordRow = {
  year: number;
  month: number;
  point: string;
  type: string;
  count: number;
};

const now = new Date();
const CURRENT_BE_YEAR = now.getFullYear() + 543;
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_BE_YEAR - 1 + i);

export default function EntryPage() {
  const [year, setYear] = useState(CURRENT_BE_YEAR);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [values, setValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const keyOf = (point: string, type: string) => `${point}|||${type}`;

  useEffect(() => {
    let cancelled = false;
    // Standard "reset, then fetch" pattern when year/month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setStatus(null);
    fetch("/api/records")
      .then((r) => r.json())
      .then((data: { records?: RecordRow[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setStatus({ type: "err", text: `โหลดข้อมูลไม่สำเร็จ: ${data.error}` });
          return;
        }
        const next: Record<string, number> = {};
        for (const p of PATIENT_TYPE_PAIRS) {
          next[keyOf(p.point, p.type)] = 0;
        }
        for (const rec of data.records ?? []) {
          if (rec.year === year && rec.month === month) {
            next[keyOf(rec.point, rec.type)] = rec.count;
          }
        }
        setValues(next);
      })
      .catch((e) => setStatus({ type: "err", text: String(e) }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof PATIENT_TYPE_PAIRS>();
    for (const p of PATIENT_TYPE_PAIRS) {
      if (!map.has(p.point)) map.set(p.point, []);
      map.get(p.point)!.push(p);
    }
    return map;
  }, []);

  const total = PATIENT_TYPE_PAIRS.reduce(
    (sum, p) => sum + (values[keyOf(p.point, p.type)] || 0),
    0
  );

  async function handleSubmit() {
    setSaving(true);
    setStatus(null);
    const entries = PATIENT_TYPE_PAIRS.map((p) => ({
      point: p.point,
      type: p.type,
      count: values[keyOf(p.point, p.type)] || 0,
    }));
    try {
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setStatus({ type: "ok", text: `บันทึกข้อมูลเดือน ${MONTH_NAMES_TH[month - 1]} ${year} เรียบร้อย` });
    } catch (e) {
      setStatus({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800">กรอกข้อมูลรายเดือน</h1>
      <p className="mt-1 text-sm text-slate-500">
        จำนวนผู้รับบริการหน่วยเจาะเลือด เก็บสิ่งส่งตรวจ และ POCT
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500">ปี พ.ศ.</label>
          <select
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">เดือน</label>
          <select
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES_TH.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-400">
          ปีงบประมาณ {fiscalYearOf(year, month)}
        </div>
        {loading && <div className="text-xs text-slate-400">กำลังโหลด...</div>}
      </div>

      {status && (
        <div
          className={`mt-4 rounded-lg px-4 py-2 text-sm ${
            status.type === "ok"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {status.text}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {SERVICE_POINTS.map((point) => (
          <div key={point} className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 font-semibold text-slate-700 rounded-t-xl">
              {point}
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {(grouped.get(point) || []).map((p) => {
                const k = keyOf(p.point, p.type);
                return (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-slate-600">{p.type}</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm"
                      value={values[k] ?? 0}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [k]: Number(e.target.value) || 0 }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600">
          ยอดรวมเดือนนี้: <span className="font-bold text-slate-800">{total.toLocaleString()}</span> คน
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || loading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </div>
    </main>
  );
}
