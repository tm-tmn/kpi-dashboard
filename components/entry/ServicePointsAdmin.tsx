"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, RotateCcw, Save, Settings2, Trash2, X } from "lucide-react";
import type { ServicePointRow, PatientTypeRow } from "@/lib/sheets-service-points";
import { StatusBanner } from "@/components/StatusBanner";

type DraftType = { type: string; active: boolean; isNew: boolean };
type DraftPoint = { point: string; active: boolean; isNew: boolean; types: DraftType[] };

/** Admin panel for จุดบริการ (service points) and the ประเภทผู้รับบริการ
 * (patient-type rows) nested under each — shared by both the "จำนวนผู้รับบริการ"
 * and "TAT" entry forms. Same soft-deactivate philosophy as
 * PmMachinesAdmin.tsx: "ปิดใช้งาน" never deletes a row, it only stops a
 * point/type from showing on the entry forms and dashboard going forward.
 * Renaming only changes the label used for NEW entries — existing sheet rows
 * saved under the old text keep that old text (no automatic rewrite of
 * historical data), which the panel discloses up front. */
export function ServicePointsAdmin({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<DraftPoint[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/service-points")
      .then((r) => r.json())
      .then((data: { points?: ServicePointRow[]; pairs?: PatientTypeRow[]; error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        const pairsByPoint = new Map<string, PatientTypeRow[]>();
        for (const pair of data.pairs ?? []) {
          if (!pairsByPoint.has(pair.point)) pairsByPoint.set(pair.point, []);
          pairsByPoint.get(pair.point)!.push(pair);
        }
        setPoints(
          (data.points ?? []).map((p) => ({
            point: p.point,
            active: p.active,
            isNew: false,
            types: (pairsByPoint.get(p.point) ?? []).map((t) => ({ type: t.type, active: t.active, isNew: false })),
          }))
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    return () => dialog?.close();
  }, [open]);

  function addPoint() {
    setPoints((prev) => [...prev, { point: "", active: true, isNew: true, types: [] }]);
  }
  function removeDraftPoint(idx: number) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }
  function updatePoint(idx: number, patch: Partial<DraftPoint>) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addType(pointIdx: number) {
    setPoints((prev) =>
      prev.map((p, i) => (i === pointIdx ? { ...p, types: [...p.types, { type: "", active: true, isNew: true }] } : p))
    );
  }
  function removeDraftType(pointIdx: number, typeIdx: number) {
    setPoints((prev) =>
      prev.map((p, i) => (i === pointIdx ? { ...p, types: p.types.filter((_, j) => j !== typeIdx) } : p))
    );
  }
  function updateType(pointIdx: number, typeIdx: number, patch: Partial<DraftType>) {
    setPoints((prev) =>
      prev.map((p, i) =>
        i === pointIdx ? { ...p, types: p.types.map((t, j) => (j === typeIdx ? { ...t, ...patch } : t)) } : p
      )
    );
  }

  async function handleSave() {
    setError(null);
    for (const p of points) {
      if (!p.point.trim()) {
        setError("กรุณากรอกชื่อจุดบริการให้ครบ");
        return;
      }
      for (const t of p.types) {
        if (!t.type.trim()) {
          setError(`กรุณากรอกชื่อประเภทผู้รับบริการให้ครบ (จุด "${p.point}")`);
          return;
        }
      }
    }
    const pointNames = points.map((p) => p.point.trim());
    if (new Set(pointNames).size !== pointNames.length) {
      setError("มีชื่อจุดบริการซ้ำกัน");
      return;
    }
    for (const p of points) {
      const typeNames = p.types.map((t) => t.type.trim());
      if (new Set(typeNames).size !== typeNames.length) {
        setError(`มีชื่อประเภทผู้รับบริการซ้ำกันในจุด "${p.point}"`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/service-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.map(({ point, active }) => ({ point: point.trim(), active })),
          pairs: points.flatMap((p) =>
            p.types.map((t) => ({ point: p.point.trim(), type: t.type.trim(), active: t.active }))
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box max-w-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-base-content/50" />
            <h3 className="text-sm font-semibold text-base-content">จัดการจุดบริการ</h3>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="btn btn-ghost btn-xs btn-circle">
            <X size={14} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-base-content/40">
          ใช้ร่วมกันทั้งฟอร์ม &quot;จำนวนผู้รับบริการ&quot; และ &quot;TAT&quot; — เพิ่ม/ปิดใช้งานจุดบริการ (ห้อง) และประเภทผู้รับบริการย่อยในแต่ละจุดได้เอง
          <br />
          <strong className="text-base-content/50">หมายเหตุการแก้ไขชื่อ:</strong> การแก้ชื่อมีผลกับข้อมูลที่กรอกใหม่เท่านั้น
          ข้อมูลเดือนเก่าที่เคยบันทึกด้วยชื่อเดิมจะยังอยู่ภายใต้ชื่อเดิมใน Google Sheet ไม่ถูกเปลี่ยนตาม
        </p>

        {error && <StatusBanner type="error" message={error} className="mb-3" />}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-base-content/40">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {points.map((p, pi) => (
              <div
                key={pi}
                className={`rounded-field border border-base-content/8 p-3 ${!p.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ชื่อจุดบริการ เช่น ห้องเจาะเลือด OPD"
                    className="input input-xs input-bordered flex-1 bg-base-200/60 font-medium"
                    value={p.point}
                    onChange={(e) => updatePoint(pi, { point: e.target.value })}
                  />
                  {p.isNew ? (
                    <button
                      onClick={() => removeDraftPoint(pi)}
                      aria-label="ลบจุดนี้"
                      title="ลบจุดนี้ (ยังไม่บันทึก)"
                      className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => updatePoint(pi, { active: !p.active })}
                      className={`btn btn-xs gap-1 ${p.active ? "btn-ghost text-base-content/50" : "btn-ghost text-success"}`}
                      title={p.active ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                    >
                      {p.active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                      {p.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  )}
                </div>

                <div className="mt-2 space-y-1.5 border-l-2 border-base-content/8 pl-3">
                  {p.types.map((t, ti) => (
                    <div key={ti} className={`flex items-center gap-2 ${!t.active ? "opacity-50" : ""}`}>
                      <input
                        type="text"
                        placeholder="ชื่อประเภทผู้รับบริการ"
                        className="input input-xs input-bordered flex-1 bg-base-200/60"
                        value={t.type}
                        onChange={(e) => updateType(pi, ti, { type: e.target.value })}
                      />
                      {t.isNew ? (
                        <button
                          onClick={() => removeDraftType(pi, ti)}
                          aria-label="ลบประเภทนี้"
                          title="ลบประเภทนี้ (ยังไม่บันทึก)"
                          className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => updateType(pi, ti, { active: !t.active })}
                          className={`btn btn-xs gap-1 ${t.active ? "btn-ghost text-base-content/50" : "btn-ghost text-success"}`}
                          title={t.active ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                        >
                          {t.active ? <Trash2 size={12} /> : <RotateCcw size={12} />}
                          {t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addType(pi)}
                    className="btn btn-ghost btn-xs gap-1.5 text-base-content/50"
                  >
                    <Plus size={12} />
                    เพิ่มประเภทผู้รับบริการ
                  </button>
                </div>
              </div>
            ))}

            <button onClick={addPoint} className="btn btn-ghost btn-sm gap-1.5 text-base-content/60">
              <Plus size={14} />
              เพิ่มจุดบริการใหม่
            </button>
          </div>
        )}

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={loading || saving} className="btn btn-primary btn-sm gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "กำลังบันทึก..." : "บันทึกจุดบริการ"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
