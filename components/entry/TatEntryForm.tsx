"use client";

import { useEffect, useMemo, useState } from "react";
import { SERVICE_POINTS, TAT_STAGES, MONTH_NAMES_TH } from "@/lib/constants";
import { pointMeta } from "@/lib/point-meta";
import { TAT_STAGE_META } from "@/lib/constants";
import { Loader2, Save, Timer } from "lucide-react";
import { BentoCard } from "@/components/BentoCard";
import { StatusBanner } from "@/components/StatusBanner";
import { TatYearTable } from "@/components/entry/TatYearTable";

type TatRecordRow = {
  year: number;
  month: number;
  point: string;
  stage: string;
  minutes: number;
};

const now = new Date();
const CURRENT_BE_YEAR = now.getFullYear() + 543;
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_BE_YEAR - 1 + i);

const keyOf = (point: string, stage: string) => `${point}|||${stage}`;

export function TatEntryForm() {
  const [year, setYear] = useState(CURRENT_BE_YEAR);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<TatRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch("/api/tat")
      .then((r) => r.json())
      .then((data: { records?: TatRecordRow[]; error?: string }) => {
        if (data.error) {
          setStatus({ type: "err", text: `โหลดข้อมูลไม่สำเร็จ: ${data.error}` });
          return;
        }
        setRecords(data.records ?? []);
      })
      .catch((e) => setStatus({ type: "err", text: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  const values = useMemo(() => {
    const next: Record<string, number> = {};
    for (const point of SERVICE_POINTS) {
      for (const stage of TAT_STAGES) next[keyOf(point, stage)] = 0;
    }
    for (const rec of records) {
      if (rec.year === year && rec.month === month) next[keyOf(rec.point, rec.stage)] = rec.minutes;
    }
    return { ...next, ...edits };
  }, [records, year, month, edits]);

  useEffect(() => {
    // Same reset-on-switch pattern as AttendanceEntryForm.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits({});
    setStatus(null);
  }, [year, month]);

  const overallAvg = useMemo(() => {
    const totalStage = TAT_STAGES[3];
    const vals = SERVICE_POINTS.map((p) => values[keyOf(p, totalStage)] || 0).filter((v) => v > 0);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [values]);

  async function handleSubmit() {
    setSaving(true);
    setStatus(null);
    // Only send (point, stage) pairs already saved for this month or edited
    // this session — an untouched pair must stay absent from the sheet, not
    // get written as a literal 0 minutes, which is never a plausible real
    // TAT value and would silently corrupt the month's averages.
    const savedKeys = new Set(
      records
        .filter((r) => r.year === year && r.month === month)
        .map((r) => keyOf(r.point, r.stage))
    );
    const entries = SERVICE_POINTS.flatMap((point) =>
      TAT_STAGES.filter((stage) => {
        const k = keyOf(point, stage);
        return k in edits || savedKeys.has(k);
      }).map((stage) => ({
        point,
        stage,
        minutes: values[keyOf(point, stage)] || 0,
      }))
    );
    try {
      const res = await fetch("/api/tat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setStatus({ type: "ok", text: `บันทึก TAT เดือน ${MONTH_NAMES_TH[month - 1]} ${year} เรียบร้อย` });
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
              ช่วงเวลา 6.00-9.00 น.
            </div>
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
                  {TAT_STAGES.map((stage) => {
                    const k = keyOf(point, stage);
                    const stageMeta = TAT_STAGE_META[stage];
                    return (
                      <div key={k} className="flex items-center justify-between gap-3">
                        <label
                          className={`text-sm ${stageMeta.total ? "font-semibold text-base-content" : "text-base-content/70"}`}
                        >
                          {stage}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            inputMode="decimal"
                            className="input input-sm input-bordered w-24 bg-base-200/60 text-right"
                            value={values[k] ?? 0}
                            onChange={(e) =>
                              setEdits((v) => ({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                          />
                          <span className="text-xs text-base-content/40">นาที</span>
                        </div>
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
            <Timer size={15} className="text-base-content/40" />
            ค่าเฉลี่ย TAT รวมเดือนนี้:{" "}
            <span className="stat-figure-num font-bold text-base-content">
              {overallAvg.toFixed(2)}
            </span>{" "}
            นาที
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

      <TatYearTable records={records} />
    </div>
  );
}
