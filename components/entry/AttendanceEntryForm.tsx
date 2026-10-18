"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PATIENT_TYPE_PAIRS,
  SERVICE_POINTS,
  MONTH_NAMES_TH,
  fiscalYearOf,
} from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import { CheckCircle2, AlertCircle, Loader2, Save, Users } from "lucide-react";
import { BentoCard } from "@/components/BentoCard";

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

export function AttendanceEntryForm() {
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
    <div className="space-y-4">
      <BentoCard i={0} className="!p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-base-content/50">ปี พ.ศ.</label>
            <select
              className="select select-bordered select-sm bg-base-200/60"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-base-content/50">เดือน</label>
            <select
              className="select select-bordered select-sm bg-base-200/60"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTH_NAMES_TH.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="badge badge-ghost border-white/10 text-xs text-base-content/50">
            ปีงบประมาณ {fiscalYearOf(year, month)}
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-base-content/40" />}
        </div>
      </BentoCard>

      {status && (
        <div
          role="alert"
          className={`alert border-0 text-sm ${
            status.type === "ok" ? "bg-success/15 text-success" : "bg-error/15 text-error"
          }`}
        >
          {status.type === "ok" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {SERVICE_POINTS.map((point, idx) => {
          const meta = pointMeta(point);
          const Icon = meta.icon;
          return (
            <BentoCard key={point} i={idx + 1} className="!p-0 overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-white/8 px-5 py-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-field"
                  style={{ background: `color-mix(in oklab, ${meta.color} 18%, transparent)`, color: meta.color }}
                >
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span className="text-sm font-semibold text-base-content">{point}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
                {(grouped.get(point) || []).map((p) => {
                  const k = keyOf(p.point, p.type);
                  return (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <label className="text-sm text-base-content/70">{p.type}</label>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        className="input input-sm input-bordered w-28 bg-base-200/60 text-right"
                        value={values[k] ?? 0}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [k]: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </BentoCard>
          );
        })}
      </div>

      <div className="glass-panel sticky bottom-4 flex items-center justify-between rounded-box p-4">
        <div className="flex items-center gap-2 text-sm text-base-content/70">
          <Users size={15} className="text-base-content/40" />
          ยอดรวมเดือนนี้:{" "}
          <span className="stat-figure-num font-bold text-base-content">{total.toLocaleString()}</span> คน
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || loading}
          className="btn btn-primary gap-2 shadow-lg shadow-primary/20"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </button>
      </div>
    </div>
  );
}
