"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { MONTH_NAMES_TH } from "@/lib/constants";
import { StatusBanner } from "@/components/StatusBanner";

type ReportType = "month" | "fiscal" | "calendar";
type Person = { name: string; position: string };

const STORAGE_KEY = "report-signers";

/** Admin dialog that builds the PDF report (monthly / fiscal-year /
 * calendar-year) via POST /api/report and downloads it. Signer names are
 * remembered in this browser only, as a convenience. */
export function ReportDialog({ onClose }: { onClose: () => void }) {
  // Mounted only while open (see the entry page), so reading the clock and
  // localStorage in state initializers is client-only and never prerendered.
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [now] = useState(() => {
    const d = new Date();
    return { be: d.getFullYear() + 543, month: d.getMonth() + 1 };
  });
  const years = Array.from({ length: 8 }, (_, i) => now.be + 1 - i);
  const [type, setType] = useState<ReportType>("month");
  // Default to the most recent completed month.
  const [year, setYear] = useState(now.month === 1 ? now.be - 1 : now.be);
  const [month, setMonth] = useState(now.month === 1 ? 12 : now.month - 1);
  const [observations, setObservations] = useState("");
  const [saved] = useState<{ preparer?: Person; approver?: Person } | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      return null; // storage unavailable — fine
    }
  });
  const [preparer, setPreparer] = useState<Person>(saved?.preparer ?? { name: "", position: "" });
  const [approver, setApprover] = useState<Person>(saved?.approver ?? { name: "", position: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Esc / backdrop close the <dialog> natively; tell the parent. No close()
    // in cleanup: the component is unmounted (element removed) when closed,
    // and a cleanup close() would queue an async "close" event that React
    // strict mode's remount would mistake for the user closing it.
    const onNativeClose = () => onClose();
    dialog.addEventListener("close", onNativeClose);
    if (!dialog.open) dialog.showModal();
    return () => dialog.removeEventListener("close", onNativeClose);
  }, [onClose]);

  async function generate() {
    setError(null);
    setBusy(true);
    try {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ preparer, approver }));
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, year, month, observations, preparer, approver }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "สร้างรายงานไม่สำเร็จ");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "month"
          ? `รายงานประจำเดือน_${year}-${String(month).padStart(2, "0")}.pdf`
          : `รายงานประจำปี${type === "fiscal" ? "งบประมาณ" : "ปฏิทิน"}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const personFields = (label: string, p: Person, set: (p: Person) => void) => (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-base-content/70">{label}</legend>
      <input
        className="input input-bordered input-sm w-full"
        placeholder="ชื่อ - สกุล"
        value={p.name}
        maxLength={100}
        onChange={(e) => set({ ...p, name: e.target.value })}
      />
      <input
        className="input input-bordered input-sm w-full"
        placeholder="ตำแหน่ง"
        value={p.position}
        maxLength={100}
        onChange={(e) => set({ ...p, position: e.target.value })}
      />
    </fieldset>
  );

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box max-w-lg">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-base-content/50" />
            <h3 className="text-sm font-semibold text-base-content">สร้างรายงาน PDF</h3>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="btn btn-ghost btn-xs btn-circle">
            <X size={14} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-base-content/40">
          สรุปจำนวนผู้รับบริการ TAT และตัวชี้วัดคุณภาพ สำหรับส่งผู้บริหาร/งานประกันคุณภาพ
          — ตัวเลขดึงจากข้อมูลชุดเดียวกับแดชบอร์ด
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="ประเภทรายงาน">
            {(
              [
                ["month", "รายเดือน"],
                ["fiscal", "รายปี (ปีงบประมาณ)"],
                ["calendar", "รายปี (ปีปฏิทิน)"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                role="radio"
                aria-checked={type === v}
                onClick={() => setType(v)}
                className={`btn btn-sm ${type === v ? "btn-primary" : "btn-ghost border-base-content/15"}`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {type === "month" && (
              <select
                className="select select-bordered select-sm flex-1"
                aria-label="เดือน"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_NAMES_TH.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <select
              className="select select-bordered select-sm flex-1"
              aria-label="ปี"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {type === "fiscal" ? `ปีงบประมาณ ${y}` : `พ.ศ. ${y}`}
                </option>
              ))}
            </select>
          </div>
          {type === "fiscal" && (
            <p className="-mt-2 text-[11px] text-base-content/40">
              ต.ค. {year - 1} – ก.ย. {year}
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-base-content/70">
              ข้อสังเกต/ความเห็น <span className="text-base-content/40">(ไม่บังคับ)</span>
            </span>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={4}
              maxLength={3000}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="พิมพ์ข้อสังเกตที่ต้องการให้ปรากฏท้ายรายงาน เว้นว่างได้"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {personFields("ผู้จัดทำ", preparer, setPreparer)}
            {personFields("ผู้อนุมัติ", approver, setApprover)}
          </div>

          {error && <StatusBanner type="error" title="สร้างรายงานไม่สำเร็จ" message={error} />}
        </div>

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            ยกเลิก
          </button>
          <button onClick={generate} disabled={busy} className="btn btn-primary btn-sm gap-1.5">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {busy ? "กำลังสร้าง..." : "สร้างและดาวน์โหลด PDF"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
