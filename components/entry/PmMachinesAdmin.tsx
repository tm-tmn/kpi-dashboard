"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, RotateCcw, Save, Settings2, Trash2, X } from "lucide-react";
import type { PmMachine } from "@/lib/sheets-pm-machines";
import { StatusBanner } from "@/components/StatusBanner";

type DraftMachine = { key: string; label: string; active: boolean; isNew: boolean };

// Slug a Thai/English label into a safe a-z0-9_ key for a brand-new machine.
// Falls back to "machine_<n>" if the label has no Latin/digit characters to
// draw from (e.g. a label typed entirely in Thai) — the admin can still edit
// the key by hand before saving.
function slugify(label: string, usedKeys: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "machine";
  let key = base;
  let n = 2;
  while (usedKeys.has(key)) key = `${base}_${n++}`;
  return key;
}

/** Admin panel for the "pm" indicator's device groups — add a new machine,
 * rename an existing one, or retire one. Retiring is a soft deactivate (not
 * a row delete): a retired machine drops off the dashboard/entry form going
 * forward, but its past months' data stays in the "ตัวชี้วัด" sheet
 * untouched, in case it needs to be reviewed or the machine is brought back. */
export function PmMachinesAdmin({
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
  const [machines, setMachines] = useState<DraftMachine[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/pm-machines")
      .then((r) => r.json())
      .then((data: { machines?: PmMachine[]; error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setMachines(
          (data.machines ?? []).map((m) => ({ key: m.key, label: m.label, active: m.active, isNew: false }))
        );
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    return () => dialog?.close();
  }, [open]);

  function addMachine() {
    const used = new Set(machines.map((m) => m.key.toLowerCase()));
    setMachines((prev) => [...prev, { key: slugify("", used), label: "", active: true, isNew: true }]);
  }

  function updateMachine(index: number, patch: Partial<DraftMachine>) {
    setMachines((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  // New (never-saved) rows can be fully removed; existing machines are only
  // ever toggled active/inactive from here, never deleted outright, to keep
  // the historical data in the "ตัวชี้วัด" sheet intact.
  function removeDraftRow(index: number) {
    setMachines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    for (const m of machines) {
      if (!m.label.trim()) {
        setError("กรุณากรอกชื่อที่แสดงให้ครบทุกเครื่อง");
        return;
      }
      if (!/^[a-z0-9_]+$/i.test(m.key)) {
        setError(`รหัสเครื่องไม่ถูกต้อง: "${m.key}" (ใช้ได้เฉพาะ a-z, 0-9, _)`);
        return;
      }
    }
    const keys = machines.map((m) => m.key.toLowerCase());
    if (new Set(keys).size !== keys.length) {
      setError("มีรหัสเครื่องซ้ำกัน กรุณาแก้ไขให้แต่ละเครื่องมีรหัสไม่ซ้ำ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pm-machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machines: machines.map(({ key, label, active }) => ({ key, label, active })),
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
      <div className="modal-box max-w-lg">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-base-content/50" />
            <h3 className="text-sm font-semibold text-base-content">จัดการเครื่อง PM</h3>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="btn btn-ghost btn-xs btn-circle">
            <X size={14} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-base-content/40">
          เพิ่มเครื่องใหม่เมื่อมีการนำเครื่องรุ่น/บริษัทใหม่เข้ามา หรือปิดใช้งานเครื่องที่เลิกใช้แล้ว —
          ข้อมูลย้อนหลังของเครื่องที่ปิดใช้งานจะยังอยู่ใน Google Sheet เหมือนเดิม ไม่ถูกลบ
        </p>

        {error && <StatusBanner type="error" message={error} className="mb-3" />}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-base-content/40">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {machines.map((m, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-field border border-base-content/8 p-2 ${
                  !m.active ? "opacity-50" : ""
                }`}
              >
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    placeholder="ชื่อที่แสดง เช่น SELECT"
                    className="input input-xs input-bordered w-full bg-base-200/60"
                    value={m.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      // Auto-derives the key only while it's still a brand-new,
                      // untouched row — once the admin edits the key directly,
                      // or the row is already saved, the label never overwrites it.
                      if (m.isNew) {
                        const used = new Set(machines.filter((_, j) => j !== i).map((x) => x.key.toLowerCase()));
                        updateMachine(i, { label, key: slugify(label, used) });
                      } else {
                        updateMachine(i, { label });
                      }
                    }}
                  />
                  <div className="flex items-center gap-1.5 text-[10px] text-base-content/35">
                    <span>รหัส:</span>
                    {m.isNew ? (
                      <input
                        type="text"
                        className="input input-xs input-bordered w-28 bg-base-200/60 font-mono"
                        value={m.key}
                        onChange={(e) => updateMachine(i, { key: e.target.value })}
                      />
                    ) : (
                      <span className="font-mono">{m.key}</span>
                    )}
                  </div>
                </div>

                {m.isNew ? (
                  <button
                    onClick={() => removeDraftRow(i)}
                    aria-label="ลบแถวนี้"
                    title="ลบแถวนี้ (ยังไม่บันทึก)"
                    className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => updateMachine(i, { active: !m.active })}
                    className={`btn btn-xs gap-1 ${m.active ? "btn-ghost text-base-content/50" : "btn-ghost text-success"}`}
                    title={m.active ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                  >
                    {m.active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                    {m.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                  </button>
                )}
              </div>
            ))}

            <button onClick={addMachine} className="btn btn-ghost btn-xs gap-1.5 text-base-content/60">
              <Plus size={14} />
              เพิ่มเครื่องใหม่
            </button>
          </div>
        )}

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={loading || saving} className="btn btn-primary btn-sm gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "กำลังบันทึก..." : "บันทึกรายการเครื่อง"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
