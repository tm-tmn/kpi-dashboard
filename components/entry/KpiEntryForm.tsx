"use client";

import { useEffect, useMemo, useState } from "react";
import { KPI_INDICATORS, MONTH_NAMES_TH, fiscalYearOf } from "@/lib/constants";
import { monthTotal, RecordRow } from "@/lib/aggregate";
import { kpiMonthResult, KpiRecordRow } from "@/lib/aggregate-kpi";
import {
  Loader2, Save, ShieldCheck, Info, XCircle, Wrench, Timer, Smile, MessageSquareWarning,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BentoCard } from "@/components/BentoCard";
import { StatusBanner } from "@/components/StatusBanner";
import { KpiYearTable } from "@/components/entry/KpiYearTable";

const now = new Date();
const CURRENT_BE_YEAR = now.getFullYear() + 543;
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_BE_YEAR - 1 + i);

const keyOf = (indicator: string, field: string) => `${indicator}|||${field}`;

// Same decorative icon + fixed categorical accent per indicator as the
// dashboard's score tiles (app/page.tsx) — identity only, never status.
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

export function KpiEntryForm() {
  const [year, setYear] = useState(CURRENT_BE_YEAR);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<KpiRecordRow[]>([]);
  const [attendance, setAttendance] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/kpi").then((r) => r.json()),
      fetch("/api/records").then((r) => r.json()),
    ])
      .then(([kpiData, recData]: [{ records?: KpiRecordRow[]; error?: string }, { records?: RecordRow[]; error?: string }]) => {
        if (kpiData.error) {
          setStatus({ type: "err", text: `โหลดข้อมูลไม่สำเร็จ: ${kpiData.error}` });
          return;
        }
        setRecords(kpiData.records ?? []);
        setAttendance(recData.records ?? []);
      })
      .catch((e) => setStatus({ type: "err", text: String(e) }))
      .finally(() => setLoading(false));
  }, []);

  const attendanceTotal = useMemo(() => monthTotal(attendance, year, month), [attendance, year, month]);

  // Raw string value for a field: saved value overlaid with any in-progress edit.
  function rawValue(indicator: string, field: string, fallback = ""): string {
    const k = keyOf(indicator, field);
    if (k in edits) return edits[k];
    const rec = records.find(
      (r) => r.year === year && r.month === month && r.indicator === indicator && r.field === field
    );
    return rec?.value ?? fallback;
  }
  function boolValue(indicator: string, field: string): boolean {
    const v = rawValue(indicator, field);
    return v === "TRUE" || v === "true" || v === "1";
  }
  function setField(indicator: string, field: string, value: string) {
    setEdits((prev) => ({ ...prev, [keyOf(indicator, field)]: value }));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdits({});
    setStatus(null);
  }, [year, month]);

  // Every (indicator, field) the form can show, with the exact same default
  // fallback each NumberField/checkbox renders when untouched — so a field
  // the user left at its on-screen default (e.g. "0" incidents, left alone
  // because there genuinely were none) is treated as that real value
  // immediately (live %/status preview included), not as "no data yet".
  function allFieldSlots(): { indicator: string; field: string; fallback: string }[] {
    const slots: { indicator: string; field: string; fallback: string }[] = [];
    for (const indicator of KPI_INDICATORS) {
      switch (indicator.kind) {
        case "ratio_auto":
          slots.push({ indicator: indicator.id, field: indicator.numerator.key, fallback: "0" });
          break;
        case "ratio_editable":
          slots.push({ indicator: indicator.id, field: indicator.numerator.key, fallback: "0" });
          slots.push({ indicator: indicator.id, field: indicator.denominator.key, fallback: String(attendanceTotal) });
          if (indicator.directField) {
            slots.push({ indicator: indicator.id, field: indicator.directField.key, fallback: "" });
          }
          break;
        case "ratio_pair":
          slots.push({ indicator: indicator.id, field: indicator.numerator.key, fallback: "0" });
          slots.push({ indicator: indicator.id, field: indicator.denominator.key, fallback: "0" });
          break;
        case "direct_percent":
          slots.push({ indicator: indicator.id, field: indicator.field.key, fallback: "0" });
          break;
        case "pm":
          for (const g of indicator.groups) {
            slots.push({ indicator: indicator.id, field: `${g.key}_pending`, fallback: "FALSE" });
            slots.push({ indicator: indicator.id, field: `${g.key}_success`, fallback: "0" });
            slots.push({ indicator: indicator.id, field: `${g.key}_total`, fallback: "0" });
          }
          break;
        case "incident":
          slots.push({ indicator: indicator.id, field: indicator.countField.key, fallback: "0" });
          slots.push({ indicator: indicator.id, field: indicator.checkboxField.key, fallback: "FALSE" });
          break;
      }
    }
    return slots;
  }

  // Build a "draft" records array (defaults + saved + in-progress edits, in
  // that priority) so the live computed %/status readouts match exactly
  // what the inputs show on screen — including an untouched field's default
  // (e.g. safety incidents defaulting to 0 should read as PASS right away,
  // not only after the user types into that field and back out).
  const draftRecords: KpiRecordRow[] = useMemo(() => {
    const others = records.filter((r) => !(r.year === year && r.month === month));
    const current = new Map<string, string>();
    for (const slot of allFieldSlots()) {
      if (slot.fallback !== "") current.set(keyOf(slot.indicator, slot.field), slot.fallback);
    }
    for (const r of records) {
      if (r.year === year && r.month === month) current.set(keyOf(r.indicator, r.field), r.value);
    }
    for (const [k, v] of Object.entries(edits)) current.set(k, v);
    const merged = Array.from(current.entries()).map(([k, value]) => {
      const [indicator, field] = k.split("|||");
      return { year, month, indicator, field, value };
    });
    return [...others, ...merged];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, edits, year, month, attendanceTotal]);

  async function handleSubmit() {
    setSaving(true);
    setStatus(null);
    const entries = allFieldSlots()
      .map(({ indicator, field, fallback }) => ({ indicator, field, value: rawValue(indicator, field, fallback) }))
      .filter(({ value }) => value !== "");
    try {
      const res = await fetch("/api/kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setStatus({ type: "ok", text: `บันทึกตัวชี้วัดคุณภาพเดือน ${MONTH_NAMES_TH[month - 1]} ${year} เรียบร้อย` });
      // Mirror exactly what was just saved (every field slot, not only the
      // ones the user actively edited this session) so the on-screen state
      // matches the sheet without waiting for a refetch.
      const others = records.filter((r) => !(r.year === year && r.month === month));
      const saved = entries.map((e) => ({ year, month, indicator: e.indicator, field: e.field, value: String(e.value) }));
      setRecords([...others, ...saved]);
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
              ปีงบประมาณ {fiscalYearOf(year, month)}
            </div>
            {loading && <Loader2 size={16} className="animate-spin text-base-content/40" />}
          </div>
        </BentoCard>

        {status && (
          <StatusBanner type={status.type === "ok" ? "success" : "error"} message={status.text} />
        )}

        <div className="space-y-4">
          {KPI_INDICATORS.map((indicator, idx) => {
            const result = kpiMonthResult(indicator, draftRecords, attendance, year, month);
            const Icon = KPI_ICON_META[indicator.id] ?? ShieldCheck;
            const accent = KPI_ACCENTS[idx % KPI_ACCENTS.length];
            return (
              <BentoCard key={indicator.id} i={idx + 1} className="!p-0 overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-base-content/8 px-5 py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="icon-badge mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-field"
                      style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
                    >
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-base-content">{indicator.shortName ?? indicator.name}</div>
                      <div className="mt-0.5 flex items-start gap-1.5 text-[11px] text-base-content/40">
                        <Info size={12} className="mt-0.5 shrink-0" />
                        {indicator.criteria}
                      </div>
                    </div>
                  </div>
                  {(result.pct != null || result.note) && (
                    <div
                      className={`rounded-field px-2.5 py-1 text-sm font-bold ${
                        result.note
                          ? "bg-base-content/5 text-base-content/50"
                          : "stat-figure-num " +
                            (result.status === "fail"
                              ? "bg-error/15 text-error"
                              : result.status === "pass"
                                ? "bg-success/15 text-success"
                                : "bg-primary/10 text-primary")
                      }`}
                    >
                      {result.note ?? `${result.pct!.toFixed(indicator.decimals ?? 1)}%`}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  {indicator.kind === "ratio_auto" && (
                    <div className="flex flex-wrap items-end gap-4">
                      <NumberField
                        label={indicator.numerator.label}
                        value={rawValue(indicator.id, indicator.numerator.key, "0")}
                        onChange={(v) => setField(indicator.id, indicator.numerator.key, v)}
                      />
                      <ReadonlyField label="จำนวนผู้รับบริการทั้งหมด (ดึงอัตโนมัติจากฐานข้อมูลที่ 1)" value={attendanceTotal.toLocaleString()} />
                    </div>
                  )}

                  {indicator.kind === "ratio_editable" && (
                    <div className="space-y-2">
                      {indicator.directField && (
                        <div className="flex flex-wrap items-end gap-4 border-b border-base-content/8 pb-2">
                          <NumberField
                            label={indicator.directField.label}
                            unit="%"
                            value={rawValue(indicator.id, indicator.directField.key, "")}
                            onChange={(v) => setField(indicator.id, indicator.directField!.key, v)}
                          />
                          <p className="max-w-sm text-[11px] text-base-content/35">
                            ใช้เมื่อเดือนนั้นไม่มีข้อมูลนับรายเป็นจำนวนคน (เหมือนไฟล์ต้นฉบับที่บางเดือนกรอก % ตรง ๆ) —
                            ถ้ากรอกจำนวนทั้ง 2 ช่องด้านล่างไว้แล้ว ระบบจะใช้ค่าที่คำนวณจากจำนวนก่อนเสมอ
                          </p>
                        </div>
                      )}
                      <div className="flex flex-wrap items-end gap-4">
                        <NumberField
                          label={indicator.numerator.label}
                          value={rawValue(indicator.id, indicator.numerator.key, "0")}
                          onChange={(v) => setField(indicator.id, indicator.numerator.key, v)}
                        />
                        <NumberField
                          label={indicator.denominator.label}
                          value={rawValue(indicator.id, indicator.denominator.key, String(attendanceTotal))}
                          onChange={(v) => setField(indicator.id, indicator.denominator.key, v)}
                        />
                      </div>
                      <p className="text-[11px] text-base-content/35">
                        ค่าตั้งต้นดึงจากฐานข้อมูลที่ 1 ({attendanceTotal.toLocaleString()} คน) แต่แก้ไขได้ —
                        เพราะตัวเลขในไฟล์เดิมของตัวชี้วัดนี้ไม่ตรงกับยอดรวมผู้รับบริการทุกเดือนเป๊ะเหมือนตัวชี้วัดข้อ 1
                      </p>
                    </div>
                  )}

                  {indicator.kind === "ratio_pair" && (
                    <div className="flex flex-wrap items-end gap-4">
                      <NumberField
                        label={indicator.numerator.label}
                        value={rawValue(indicator.id, indicator.numerator.key, "0")}
                        onChange={(v) => setField(indicator.id, indicator.numerator.key, v)}
                      />
                      <NumberField
                        label={indicator.denominator.label}
                        value={rawValue(indicator.id, indicator.denominator.key, "0")}
                        onChange={(v) => setField(indicator.id, indicator.denominator.key, v)}
                      />
                    </div>
                  )}

                  {indicator.kind === "direct_percent" && (
                    <NumberField
                      label={indicator.field.label}
                      value={rawValue(indicator.id, indicator.field.key, "0")}
                      unit="%"
                      onChange={(v) => setField(indicator.id, indicator.field.key, v)}
                    />
                  )}

                  {indicator.kind === "pm" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {indicator.groups.map((g) => {
                        const pending = boolValue(indicator.id, `${g.key}_pending`);
                        const groupResult = result.detail.find((d) => d.label === g.label);
                        return (
                          <div key={g.key} className="rounded-field border border-base-content/8 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-base-content/80">{g.label}</span>
                              {groupResult?.pct != null && (
                                <span className="stat-figure-num text-xs font-bold text-base-content/70">
                                  {groupResult.pct.toFixed(indicator.decimals ?? 1)}%
                                </span>
                              )}
                              {pending && <span className="badge badge-ghost text-[10px]">รอทำสัญญา</span>}
                            </div>
                            <label className="mb-2 flex items-center gap-2 text-[11px] text-base-content/50">
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs"
                                checked={pending}
                                onChange={(e) => setField(indicator.id, `${g.key}_pending`, e.target.checked ? "TRUE" : "FALSE")}
                              />
                              รอทำสัญญา (ยังไม่มีเครื่อง/ยังไม่ได้ PM)
                            </label>
                            <div className={`flex gap-3 ${pending ? "pointer-events-none opacity-40" : ""}`}>
                              <NumberField
                                label="ผ่านเกณฑ์"
                                compact
                                value={rawValue(indicator.id, `${g.key}_success`, "0")}
                                onChange={(v) => setField(indicator.id, `${g.key}_success`, v)}
                              />
                              <NumberField
                                label="ทั้งหมด"
                                compact
                                value={rawValue(indicator.id, `${g.key}_total`, "0")}
                                onChange={(v) => setField(indicator.id, `${g.key}_total`, v)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {indicator.kind === "incident" && (
                    <div className="flex flex-wrap items-end gap-6">
                      <NumberField
                        label={indicator.countField.label}
                        value={rawValue(indicator.id, indicator.countField.key, "0")}
                        onChange={(v) => setField(indicator.id, indicator.countField.key, v)}
                      />
                      <label className="flex items-center gap-2 text-sm text-base-content/70">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={boolValue(indicator.id, indicator.checkboxField.key)}
                          onChange={(e) =>
                            setField(indicator.id, indicator.checkboxField.key, e.target.checked ? "TRUE" : "FALSE")
                          }
                        />
                        <ShieldCheck size={14} className="text-base-content/40" />
                        {indicator.checkboxField.label}
                      </label>
                      {result.status && (
                        <span
                          className={`badge border-0 ${
                            result.status === "pass" ? "bg-success/15 text-success" : "bg-error/15 text-error"
                          }`}
                        >
                          {result.status === "pass" ? "PASS" : "FAIL"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </BentoCard>
            );
          })}
        </div>

        <div className="glass-panel sticky bottom-4 flex items-center justify-between rounded-box p-4">
          <div className="text-sm text-base-content/60">กรอกครบ 6 ตัวชี้วัดแล้วกดบันทึก</div>
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

      <KpiYearTable records={records} attendance={attendance} />
    </div>
  );
}

function NumberField({
  label, value, onChange, unit, compact,
}: { label: string; value: string; onChange: (v: string) => void; unit?: string; compact?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-base-content/50">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          // A plain text input (not type="number") so typing is never locked —
          // no rejected keystrokes, no inability to clear the field, no
          // browser-specific quirks around pasting. Only format is validated,
          // not every keystroke, so the user can freely type/backspace/select.
          type="text"
          inputMode="decimal"
          className={`input input-sm input-bordered bg-base-200/60 text-right ${compact ? "w-20" : "w-28"}`}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) onChange(v);
          }}
        />
        {unit && <span className="text-xs text-base-content/40">{unit}</span>}
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-base-content/50">{label}</label>
      <div className="input input-sm w-32 cursor-not-allowed items-center bg-base-200/30 text-right text-base-content/50">
        {value}
      </div>
    </div>
  );
}
