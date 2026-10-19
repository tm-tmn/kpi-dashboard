"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ListChecks, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { KPI_INDICATORS } from "@/lib/constants";
import type { KpiIndicatorConfigRow } from "@/lib/sheets-kpi-indicators";
import { StatusBanner } from "@/components/StatusBanner";

const BASE_IDS = KPI_INDICATORS.map((k) => k.id);

type CustomKind = "direct_percent" | "ratio_pair" | "incident";

const KIND_LABELS: Record<CustomKind, string> = {
  direct_percent: "กรอกเปอร์เซ็นต์ตรง 1 ช่อง",
  ratio_pair: "กรอกจำนวน 2 ช่อง แล้วคำนวณ % อัตโนมัติ",
  incident: "นับจำนวนอุบัติการณ์ + เช็คบ็อกซ์ยืนยัน",
};

type DraftItem = {
  id: string;
  name: string;
  shortName: string;
  criteria: string;
  kind: "" | CustomKind; // "" = one of the 6 original indicators (locked)
  field1Label: string;
  field2Label: string;
  targetValue: string;
  targetDirection: "max" | "min";
  decimals: string;
  active: boolean;
  isNew: boolean;
  isCustom: boolean;
  /** UI only: whether a built-in indicator's edit fields are expanded. */
  editing?: boolean;
  /** Built-in indicators only: the kind (never editable), used to hide
   * target/decimals for the incident kind where they don't apply. */
  baseKind?: string;
};

// Slug a Thai/English name into a safe a-z0-9_ id for a brand-new custom
// indicator — same approach as PM machines' key slugify, also avoiding the
// 6 original indicators' ids since those are reserved.
function slugify(name: string, used: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "indicator";
  let id = base;
  let n = 2;
  while (used.has(id) || BASE_IDS.includes(id)) id = `${base}_${n++}`;
  return id;
}

function buildInitialList(config: KpiIndicatorConfigRow[]): DraftItem[] {
  const cfgById = new Map(config.map((r) => [r.id, r]));

  const ordered: { item: DraftItem; order: number }[] = KPI_INDICATORS.map((ind, i) => {
    const cfg = cfgById.get(ind.id);
    // Effective values = admin override if set, else the hardcoded default.
    const effTarget =
      cfg && cfg.targetValue != null && cfg.targetDirection !== ""
        ? { value: cfg.targetValue, direction: cfg.targetDirection as "max" | "min" }
        : ind.target;
    const item: DraftItem = {
      id: ind.id,
      name: cfg?.name || ind.name,
      shortName: cfg?.shortName || ind.shortName || ind.name,
      criteria: cfg?.criteria || ind.criteria,
      kind: "",
      field1Label: "",
      field2Label: "",
      targetValue: effTarget ? String(effTarget.value) : "",
      targetDirection: effTarget?.direction ?? "max",
      decimals: cfg?.decimals != null ? String(cfg.decimals) : ind.decimals != null ? String(ind.decimals) : "",
      active: cfg ? cfg.active : true,
      isNew: false,
      isCustom: false,
      editing: false,
      baseKind: ind.kind,
    };
    return { item, order: cfg ? cfg.order : i };
  });

  for (const r of config) {
    if (BASE_IDS.includes(r.id) || r.kind === "") continue;
    const item: DraftItem = {
      id: r.id,
      name: r.name,
      shortName: r.shortName || r.name,
      criteria: r.criteria,
      kind: r.kind,
      field1Label: r.field1Label,
      field2Label: r.field2Label,
      targetValue: r.targetValue != null ? String(r.targetValue) : "",
      targetDirection: r.targetDirection === "min" ? "min" : "max",
      decimals: r.decimals != null ? String(r.decimals) : "",
      active: r.active,
      isNew: false,
      isCustom: true,
    };
    ordered.push({ item, order: r.order });
  }

  return ordered.sort((a, b) => a.order - b.order).map((e) => e.item);
}

/** Admin panel for the "ตัวชี้วัดคุณภาพ" list itself: deactivate/reactivate
 * any of the 6 original indicators, or add a brand-new one in one of 3
 * generic shapes (a single %, a count/count ratio, or an incident count +
 * checkbox). Deactivating never deletes past months' data from the
 * "ตัวชี้วัด" sheet — same soft-deactivate pattern as PM machines and
 * จุดบริการ/ประเภทผู้รับบริการ. A custom indicator's `id` is fixed once saved
 * (embedded in its field keys), so only name/criteria/labels/target can be
 * edited afterward — renaming never breaks its historical data. */
export function KpiIndicatorsAdmin({
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
  const [items, setItems] = useState<DraftItem[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch("/api/kpi-indicators")
      .then((r) => r.json())
      .then((data: { config?: KpiIndicatorConfigRow[]; error?: string }) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setItems(buildInitialList(data.config ?? []));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
    return () => dialog?.close();
  }, [open]);

  function addCustom() {
    const used = new Set(items.map((it) => it.id.toLowerCase()));
    setItems((prev) => [
      ...prev,
      {
        id: slugify("", used),
        name: "",
        shortName: "",
        criteria: "",
        kind: "direct_percent",
        field1Label: "",
        field2Label: "",
        targetValue: "",
        targetDirection: "max",
        decimals: "",
        active: true,
        isNew: true,
        isCustom: true,
      },
    ]);
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeDraftRow(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError(null);
    for (const it of items) {
      if (!it.isCustom) {
        if (!it.name.trim() || !it.criteria.trim()) {
          setError(`ชื่อและเกณฑ์ประเมินของ "${it.shortName || it.id}" ต้องไม่ว่าง`);
          return;
        }
        if (it.targetValue !== "") {
          const v = Number(it.targetValue);
          if (!Number.isFinite(v) || v < 0 || v > 100) {
            setError(`ค่าเป้าหมายต้องเป็นตัวเลข 0-100 สำหรับ "${it.shortName}"`);
            return;
          }
        }
        continue;
      }
      if (!it.name.trim()) {
        setError("กรุณากรอกชื่อตัวชี้วัดให้ครบทุกข้อที่เพิ่มเอง");
        return;
      }
      if (!it.criteria.trim()) {
        setError(`กรุณากรอกเกณฑ์ประเมินสำหรับ "${it.name}"`);
        return;
      }
      if (!/^[a-z0-9_]+$/i.test(it.id)) {
        setError(`รหัสตัวชี้วัดไม่ถูกต้อง: "${it.id}" (ใช้ได้เฉพาะ a-z, 0-9, _)`);
        return;
      }
      if (!it.field1Label.trim()) {
        setError(`กรุณากรอกชื่อช่องกรอกข้อมูลสำหรับ "${it.name}"`);
        return;
      }
      if ((it.kind === "ratio_pair" || it.kind === "incident") && !it.field2Label.trim()) {
        setError(`กรุณากรอกชื่อช่องกรอกข้อมูลช่องที่ 2 สำหรับ "${it.name}"`);
        return;
      }
      if (it.targetValue !== "") {
        const v = Number(it.targetValue);
        if (!Number.isFinite(v) || v < 0 || v > 100) {
          setError(`ค่าเป้าหมายต้องเป็นตัวเลข 0-100 สำหรับ "${it.name}"`);
          return;
        }
      }
    }
    const ids = items.map((it) => it.id.toLowerCase());
    if (new Set(ids).size !== ids.length) {
      setError("มีรหัสตัวชี้วัดซ้ำกัน กรุณาแก้ไขให้แต่ละข้อมีรหัสไม่ซ้ำ");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/kpi-indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: items.map((it, i) => {
            if (it.isCustom) {
              return {
                id: it.id,
                name: it.name.trim(),
                shortName: it.shortName.trim(),
                criteria: it.criteria.trim(),
                kind: it.kind,
                field1Label: it.field1Label.trim(),
                field2Label: it.field2Label.trim(),
                targetValue: it.targetValue !== "" ? Number(it.targetValue) : null,
                targetDirection: it.targetValue !== "" ? it.targetDirection : "",
                decimals: it.decimals !== "" ? Number(it.decimals) : null,
                order: i,
                active: it.active,
              };
            }
            // Built-in: store only what differs from the hardcoded default,
            // so untouched fields keep following lib/constants.ts.
            const base = KPI_INDICATORS.find((k) => k.id === it.id)!;
            const defShort = base.shortName ?? base.name;
            const defTarget = base.target;
            const tv = it.targetValue !== "" ? Number(it.targetValue) : null;
            const targetChanged =
              tv != null && (!defTarget || defTarget.value !== tv || defTarget.direction !== it.targetDirection);
            const dec = it.decimals !== "" ? Number(it.decimals) : null;
            return {
              id: it.id,
              name: it.name.trim() !== base.name ? it.name.trim() : "",
              shortName: it.shortName.trim() !== defShort ? it.shortName.trim() : "",
              criteria: it.criteria.trim() !== base.criteria ? it.criteria.trim() : "",
              kind: "",
              field1Label: "",
              field2Label: "",
              targetValue: targetChanged ? tv : null,
              targetDirection: targetChanged ? it.targetDirection : "",
              decimals: dec != null && dec !== base.decimals ? dec : null,
              order: i,
              active: it.active,
            };
          }),
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
            <ListChecks size={16} className="text-base-content/50" />
            <h3 className="text-sm font-semibold text-base-content">จัดการตัวชี้วัดคุณภาพ</h3>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="btn btn-ghost btn-xs btn-circle">
            <X size={14} />
          </button>
        </div>
        <p className="mb-4 text-[11px] text-base-content/40">
          ปิดใช้งานตัวชี้วัดข้อใดก็ได้ (รวมทั้ง 6 ข้อเดิม) เพื่อซ่อนออกจากหน้ากรอกข้อมูลและแดชบอร์ด หรือเพิ่มตัวชี้วัดใหม่ —
          ข้อมูลย้อนหลังของตัวชี้วัดที่ปิดใช้งานจะยังอยู่ใน Google Sheet เหมือนเดิม ไม่ถูกลบ
        </p>

        {error && <StatusBanner type="error" message={error} className="mb-3" />}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-base-content/40">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {items.map((it, i) => (
              <div
                key={i}
                className={`rounded-field border border-base-content/8 p-3 ${!it.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    {it.isCustom ? (
                      <>
                        <input
                          type="text"
                          placeholder="ชื่อตัวชี้วัด (เต็ม)"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            if (it.isNew) {
                              const used = new Set(items.filter((_, j) => j !== i).map((x) => x.id.toLowerCase()));
                              updateItem(i, { name, id: slugify(name, used) });
                            } else {
                              updateItem(i, { name });
                            }
                          }}
                        />
                        <input
                          type="text"
                          placeholder="ชื่อย่อ (แสดงในการ์ด/กราฟ — ไม่กรอกได้)"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.shortName}
                          onChange={(e) => updateItem(i, { shortName: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="เกณฑ์ประเมิน เช่น ต้องผ่านมากกว่าร้อยละ 90 ในแต่ละเดือน"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.criteria}
                          onChange={(e) => updateItem(i, { criteria: e.target.value })}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-[10px] text-base-content/35">รูปแบบการกรอกข้อมูล:</label>
                          {it.isNew ? (
                            <select
                              className="select select-xs select-bordered bg-base-200/60"
                              value={it.kind}
                              onChange={(e) => updateItem(i, { kind: e.target.value as CustomKind })}
                            >
                              {(Object.keys(KIND_LABELS) as CustomKind[]).map((k) => (
                                <option key={k} value={k}>{KIND_LABELS[k]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[11px] text-base-content/50">{KIND_LABELS[it.kind as CustomKind]}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            placeholder={
                              it.kind === "direct_percent"
                                ? "ชื่อช่องกรอกค่า เช่น ร้อยละความพึงพอใจ"
                                : it.kind === "ratio_pair"
                                  ? "ชื่อช่องตัวตั้ง เช่น จำนวนที่ผ่านเกณฑ์"
                                  : "ชื่อช่องจำนวนอุบัติการณ์"
                            }
                            className="input input-xs input-bordered w-full bg-base-200/60"
                            value={it.field1Label}
                            onChange={(e) => updateItem(i, { field1Label: e.target.value })}
                          />
                          {it.kind !== "direct_percent" && (
                            <input
                              type="text"
                              placeholder={
                                it.kind === "ratio_pair" ? "ชื่อช่องตัวหาร เช่น จำนวนทั้งหมด" : "ชื่อเช็คบ็อกซ์ เช่น ดำเนินการแล้ว"
                              }
                              className="input input-xs input-bordered w-full bg-base-200/60"
                              value={it.field2Label}
                              onChange={(e) => updateItem(i, { field2Label: e.target.value })}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-base-content/40">
                          <span>เป้าหมาย:</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="ไม่ตั้งเป้าหมาย"
                            className="input input-xs input-bordered w-24 bg-base-200/60"
                            value={it.targetValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^\d*\.?\d*$/.test(v)) updateItem(i, { targetValue: v });
                            }}
                          />
                          <span>%</span>
                          {it.targetValue !== "" && (
                            <select
                              className="select select-xs select-bordered bg-base-200/60"
                              value={it.targetDirection}
                              onChange={(e) => updateItem(i, { targetDirection: e.target.value as "max" | "min" })}
                            >
                              <option value="max">ต้องได้อย่างน้อยเท่านี้ (max)</option>
                              <option value="min">ต้องไม่เกินเท่านี้ (min)</option>
                            </select>
                          )}
                          <span className="ml-2">ทศนิยม:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="1"
                            className="input input-xs input-bordered w-12 bg-base-200/60"
                            value={it.decimals}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "" || /^\d*$/.test(v)) updateItem(i, { decimals: v });
                            }}
                          />
                          <span className="ml-auto font-mono text-base-content/30">รหัส: {it.id}</span>
                        </div>
                      </>
                    ) : it.editing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="ชื่อตัวชี้วัด (เต็ม)"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.name}
                          onChange={(e) => updateItem(i, { name: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="ชื่อย่อ (แสดงในการ์ด/กราฟ)"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.shortName}
                          onChange={(e) => updateItem(i, { shortName: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="เกณฑ์ประเมิน"
                          className="input input-xs input-bordered w-full bg-base-200/60"
                          value={it.criteria}
                          onChange={(e) => updateItem(i, { criteria: e.target.value })}
                        />
                        {it.baseKind !== "incident" && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-base-content/40">
                            <span>เป้าหมาย:</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="ไม่มี"
                              className="input input-xs input-bordered w-20 bg-base-200/60"
                              value={it.targetValue}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^\d*\.?\d*$/.test(v)) updateItem(i, { targetValue: v });
                              }}
                            />
                            <span>%</span>
                            {it.targetValue !== "" && (
                              <select
                                className="select select-xs select-bordered bg-base-200/60"
                                value={it.targetDirection}
                                onChange={(e) => updateItem(i, { targetDirection: e.target.value as "max" | "min" })}
                              >
                                <option value="max">ต้องได้อย่างน้อยเท่านี้ (max)</option>
                                <option value="min">ต้องไม่เกินเท่านี้ (min)</option>
                              </select>
                            )}
                            <span className="ml-2">ทศนิยม:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="1"
                              className="input input-xs input-bordered w-12 bg-base-200/60"
                              value={it.decimals}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "" || /^\d*$/.test(v)) updateItem(i, { decimals: v });
                              }}
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-base-content/30">
                          ชื่อช่องกรอกข้อมูลภายในของตัวชี้วัดเดิมแก้ไขไม่ได้จากหน้านี้ — การแก้ชื่อ/เกณฑ์/เป้าหมายไม่กระทบข้อมูลย้อนหลัง
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-semibold text-base-content/80">{it.shortName}</div>
                        <div className="mt-0.5 text-[11px] text-base-content/40">{it.criteria}</div>
                      </div>
                    )}
                  </div>

                  {it.isNew ? (
                    <button
                      onClick={() => removeDraftRow(i)}
                      aria-label="ลบแถวนี้"
                      title="ลบแถวนี้ (ยังไม่บันทึก)"
                      className="btn btn-ghost btn-xs btn-circle shrink-0 text-base-content/40 hover:text-error"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                    {!it.isCustom && (
                      <button
                        onClick={() => updateItem(i, { editing: !it.editing })}
                        className="btn btn-ghost btn-xs gap-1 text-base-content/50"
                        title="แก้ไขชื่อ/เกณฑ์/เป้าหมาย"
                      >
                        <Pencil size={12} />
                        {it.editing ? "ย่อ" : "แก้ไข"}
                      </button>
                    )}
                    <button
                      onClick={() => updateItem(i, { active: !it.active })}
                      className={`btn btn-xs shrink-0 gap-1 ${it.active ? "btn-ghost text-base-content/50" : "btn-ghost text-success"}`}
                      title={it.active ? "ปิดใช้งาน" : "เปิดใช้งานอีกครั้ง"}
                    >
                      {it.active ? <Trash2 size={13} /> : <RotateCcw size={13} />}
                      {it.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button onClick={addCustom} className="btn btn-ghost btn-xs gap-1.5 text-base-content/60">
              <Plus size={14} />
              เพิ่มตัวชี้วัดใหม่
            </button>
          </div>
        )}

        <div className="modal-action">
          <button onClick={onClose} className="btn btn-ghost btn-sm">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={loading || saving} className="btn btn-primary btn-sm gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "กำลังบันทึก..." : "บันทึกรายการตัวชี้วัด"}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
