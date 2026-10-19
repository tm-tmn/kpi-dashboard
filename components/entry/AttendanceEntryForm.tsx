"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PATIENT_TYPE_PAIRS,
  SERVICE_POINTS,
  MONTH_NAMES_TH,
  fiscalYearOf,
  fiscalYearMonthsFilled,
} from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import { Loader2, Save, Users } from "lucide-react";
import { BentoCard } from "@/components/BentoCard";
import { StatusBanner } from "@/components/StatusBanner";
import { AttendanceYearTable } from "@/components/entry/AttendanceYearTable";
import { CompletenessBadge } from "@/components/entry/CompletenessBadge";

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

const keyOf = (point: string, type: string) => `${point}|||${type}`;

export function AttendanceEntryForm() {
  const [year, setYear] = useState(CURRENT_BE_YEAR);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});

  // Fetch the whole sheet once; the table and the month editor both derive
  // from this one list, instead of each re-fetching on every selector change.
  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((data: { records?: RecordRow[]; error?: string }) => {
        if (data.error) {
          setStatus({ type: "err", text: `โหลดข้อมูลไม่สำเร็จ: ${data.error}` });
          return;
        }
        setRecords(data.records ?? []);
      })
      .catch((e) => setStatus({ type: "err", text: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  // Values shown in the editor: saved records for (year, month), overlaid
  // with any in-progress edits the user hasn't saved yet.
  const values = useMemo(() => {
    const next: Record<string, number> = {};
    for (const p of PATIENT_TYPE_PAIRS) next[keyOf(p.point, p.type)] = 0;
    for (const rec of records) {
      if (rec.year === year && rec.month === month) next[keyOf(rec.point, rec.type)] = rec.count;
    }
    return { ...next, ...edits };
  }, [records, year, month, edits]);

  // Reset in-progress edits when switching month/year, so stale numbers
  // from a different month don't leak in.
  useEffect(() => {
    // Clear in-progress edits/status when switching month/year, so stale
    // numbers or a stale save-result banner from a different month don't
    // leak into the new selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits({});
    setStatus(null);
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

  const selectedFiscalYear = fiscalYearOf(year, month);
  const monthsFilled = useMemo(
    () => fiscalYearMonthsFilled(records, selectedFiscalYear),
    [records, selectedFiscalYear]
  );

  async function handleSubmit() {
    setSaving(true);
    setStatus(null);
    // Only send pairs that were either already saved for this month or
    // touched in this session — a pair the user never opened and never had
    // data for must stay absent from the sheet, not get written as a
    // literal 0 (which would read as "zero patients", a real and different
    // fact from "not recorded yet").
    const savedKeys = new Set(
      records
        .filter((r) => r.year === year && r.month === month)
        .map((r) => keyOf(r.point, r.type))
    );
    const entries = PATIENT_TYPE_PAIRS.filter((p) => {
      const k = keyOf(p.point, p.type);
      return k in edits || savedKeys.has(k);
    }).map((p) => ({
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
      // Merge the saved entries into the local records so the table below
      // updates immediately without a full re-fetch.
      setRecords((prev) => {
        const others = prev.filter((r) => !(r.year === year && r.month === month));
        return [...others, ...entries.map((e) => ({ year, month, ...e }))];
      });
      setEdits({});
    } catch (e) {
      setStatus({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl space-y-4">
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
            <div className="badge badge-ghost border-base-content/10 text-xs text-base-content/50">
              ปีงบประมาณ {selectedFiscalYear}
            </div>
            <CompletenessBadge filled={monthsFilled} />
            {loading && <Loader2 size={16} className="animate-spin text-base-content/40" />}
          </div>
        </BentoCard>

        {status && (
          <StatusBanner type={status.type === "ok" ? "success" : "error"} message={status.text} />
        )}

        <div className="space-y-4">
          {SERVICE_POINTS.map((point, idx) => {
            const meta = pointMeta(point);
            const Icon = meta.icon;
            return (
              <BentoCard key={point} i={idx + 1} className="!p-0 overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-base-content/8 px-5 py-3">
                  <span
                    className="icon-badge flex h-7 w-7 items-center justify-center rounded-field"
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
                            setEdits((v) => ({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) }))
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

      <AttendanceYearTable records={records} />
    </div>
  );
}
