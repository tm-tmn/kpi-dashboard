// Structure mirrors the "ข้อมูลดิบ" sheet / รายการอ้างอิง exactly.
// Keep this in sync with the Google Sheet's dropdown lists.

export const SERVICE_POINTS = [
  "ห้องเจาะเลือด OPD",
  "ห้องเจาะเลือด กว.",
  "ห้องเจาะเลือด SMC",
  "ห้องเจาะเลือดงานเวชกรรมฯ",
] as const;

export type ServicePoint = (typeof SERVICE_POINTS)[number];

// Valid (จุดบริการ, ประเภทผู้รับบริการ) pairs, in the same order as the
// original sheet so the entry form and summaries read top-to-bottom the
// same way the hospital is used to.
export const PATIENT_TYPE_PAIRS: { point: ServicePoint; type: string }[] = [
  { point: "ห้องเจาะเลือด OPD", type: "สวัสดิการ (OPD)" },
  { point: "ห้องเจาะเลือด OPD", type: "เด็ก (OPD)" },
  { point: "ห้องเจาะเลือด OPD", type: "สูงอายุ (OPD)" },
  { point: "ห้องเจาะเลือด OPD", type: "ทั่วไป (OPD)" },
  { point: "ห้องเจาะเลือด OPD", type: "รถเข็น/เตียง (OPD)" },
  { point: "ห้องเจาะเลือด OPD", type: "ส่งสิ่งส่งตรวจ (OPD)" },

  { point: "ห้องเจาะเลือด กว.", type: "สวัสดิการ (กว.)" },
  { point: "ห้องเจาะเลือด กว.", type: "เด็ก (กว.)" },
  { point: "ห้องเจาะเลือด กว.", type: "สูงอายุ (กว.)" },
  { point: "ห้องเจาะเลือด กว.", type: "ทั่วไป (กว.)" },
  { point: "ห้องเจาะเลือด กว.", type: "รถเข็น/เตียง (กว.)" },
  { point: "ห้องเจาะเลือด กว.", type: "ส่งสิ่งส่งตรวจ (กว.)" },

  { point: "ห้องเจาะเลือด SMC", type: "ทั่วไป (SMC)" },
  { point: "ห้องเจาะเลือด SMC", type: "ตรวจสุขภาพ (SMC)" },
  { point: "ห้องเจาะเลือด SMC", type: "สูงอายุ/รถเข็น (SMC)" },
  { point: "ห้องเจาะเลือด SMC", type: "ส่งสิ่งส่งตรวจ (SMC)" },

  { point: "ห้องเจาะเลือดงานเวชกรรมฯ", type: "ทั่วไป" },
];

export const MONTH_NAMES_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const MONTH_ABBR_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// TAT (turnaround time) stages for the 6.00-9.00 blood-draw service window.
// Same 4 ขั้นตอน for every จุดบริการ. "SQ Create - ABS Close" is the overall
// end-to-end time (SQ = queue ticket, ABS Close = sample fully closed out).
export const TAT_STAGES = [
  "ออกคิว - เรียกคิว",
  "เรียกคิว - เช็คอิน",
  "เก็บตัวอย่าง - ปิดงาน",
  "รวมทั้งหมด (ออกคิว - ปิดงาน)",
] as const;

export type TatStage = (typeof TAT_STAGES)[number];

// Short legend labels + a highlight flag for the "total" stage (the one the
// original Looker charts drew in green, bolder than the others).
export const TAT_STAGE_META: Record<TatStage, { short: string; color: string; total?: boolean }> = {
  "ออกคิว - เรียกคิว": { short: "ออกคิว→เรียกคิว", color: "#3DA9FC" },
  "เรียกคิว - เช็คอิน": { short: "เรียกคิว→เช็คอิน", color: "#F6A75E" },
  "เก็บตัวอย่าง - ปิดงาน": { short: "เก็บตัวอย่าง→ปิดงาน", color: "#B794F6" },
  "รวมทั้งหมด (ออกคิว - ปิดงาน)": { short: "รวมทั้งหมด", color: "#34D399", total: true },
};

// Quality indicators ("ตัวชี้วัดคุณภาพหน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT"),
// filled in once a month. Mirrors the 6 indicators in the hospital's own
// Excel form. "criteria" is a placeholder — the exact เกณฑ์ประเมิน wording/
// thresholds from the original file should be double-checked and edited in
// here directly; it is NOT guaranteed to match the hospital's real standard.
export type KpiField = { key: string; label: string };

// "name" is the full official wording from the hospital's Excel (used by the
// Excel-mirrored year table's "ตัวชี้วัด" column); "shortName" is a compact
// label for tight spots (dashboard score tiles, entry-form card headers) —
// falls back to "name" when not given. Decimal places for the headline %
// default to 1 (matches the Excel for most indicators); rejection + PM
// override to 2 since those are tracked to a finer tolerance (e.g. 0.13%,
// 96.15%).
// The pass/fail threshold from "criteria", as a number the trend chart can
// draw a reference line at and zoom its y-axis around. "direction" says which
// side is the passing side (max = at-least, min = at-most).
export type KpiTarget = { value: number; direction: "max" | "min" };

export type KpiIndicator =
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "ratio_auto"; // denominator auto-pulled from attendance total, read-only
      numerator: KpiField;
    }
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "ratio_editable"; // denominator pre-filled from attendance total but editable
      numerator: KpiField;
      denominator: KpiField;
      // Optional 3rd field: a directly-typed % that's used when the two counts
      // above aren't available that month (the hospital's own Excel does this
      // too — some months have a literal % with no backing counts, e.g. "ABS").
      // Takes effect ONLY when numerator/denominator can't produce a ratio.
      directField?: KpiField;
    }
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "ratio_pair"; // both numerator and denominator entered manually
      numerator: KpiField;
      denominator: KpiField;
    }
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "direct_percent"; // a single % value entered directly
      field: KpiField;
    }
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "pm"; // PM device groups: success count, total count, "pending contract" flag
      groups: { key: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      shortName?: string;
      criteria: string;
      decimals?: number;
      target?: KpiTarget;
      kind: "incident"; // incident count (PASS if 0) + a yes/no checkbox
      countField: KpiField;
      checkboxField: KpiField;
    };

export const KPI_INDICATORS: KpiIndicator[] = [
  {
    id: "rejection",
    name: "อัตราการปฏิเสธสิ่งส่งตรวจ(ต่อผู้รับบริการ) %Rejected specimen (Patient) ในแต่ละเดือน",
    shortName: "อัตราการปฏิเสธสิ่งส่งตรวจ",
    criteria: "อัตราการปฏิเสธสิ่งส่งตรวจ %Rejected specimen (Patient) ต้องไม่เกินร้อยละ 0.5 ในแต่ละเดือน",
    decimals: 2,
    target: { value: 0.5, direction: "min" },
    kind: "ratio_auto",
    numerator: { key: "rejection_count", label: "จำนวนอุบัติการณ์การปฏิเสธสิ่งส่งตรวจทั้งหมด" },
  },
  {
    id: "pm",
    name: "การทำ Preventive maintenance (PM) เครื่องจัดเตรียมหลอดเลือดอัตโนมัติและการทำ Corrective action ในแต่ละเดือน",
    shortName: "PM เครื่องจัดเตรียมหลอดเลือดอัตโนมัติ",
    criteria: "Preventive maintenance (PM) และ Corrective action ต้องดำเนินการสำเร็จร้อยละ 100.0 ในแต่ละเดือน/ปี",
    decimals: 2,
    target: { value: 100, direction: "max" },
    kind: "pm",
    groups: [
      { key: "select", label: "SELECT" },
      { key: "henm", label: "HEN M" },
    ],
  },
  {
    id: "tat30",
    name: "ระยะเวลาการให้บริการโดยภาพรวม (Turn Around Time) %TAT ได้ตามกำหนด (ไม่เกิน 30 นาทีต่อราย) ในแต่ละเดือน",
    shortName: "อัตราผู้รับบริการที่รอคอยไม่เกิน 30 นาที",
    criteria: "อัตราระยะเวลาการให้บริการโดยภาพรวม (Turn Around Time) %TAT ได้ตามกำหนด (ไม่เกิน 30 นาทีต่อราย) ต้องผ่านมากกว่าร้อยละ 90.0 ในแต่ละเดือน",
    decimals: 2,
    target: { value: 90, direction: "max" },
    kind: "ratio_editable",
    numerator: { key: "tat30_count", label: "จำนวนผู้รับบริการที่มีระยะเวลารอคอยไม่เกิน 30 นาที" },
    denominator: { key: "tat30_denominator", label: "จำนวนผู้รับบริการทั้งหมด" },
    directField: {
      key: "tat30_pct_direct",
      label: "อัตราผู้รับบริการที่รอคอยไม่เกิน 30 นาที (กรอกเฉพาะกรณีไม่มีข้อมูลนับรายตามจำนวนด้านบน)",
    },
  },
  {
    id: "satisfaction",
    name: "ความพึงพอใจของผู้รับบริการ",
    criteria: "เกณฑ์การประเมินต้องมีผลการประเมินความพึงพอใจมากที่สุด (ระดับ 5) มากกว่าร้อยละ 30 ในแต่ละเดือน",
    target: { value: 30, direction: "max" },
    kind: "direct_percent",
    field: { key: "satisfaction_pct", label: "ร้อยละความพึงพอใจ" },
  },
  {
    id: "complaint",
    name: "เรื่องร้องเรียนได้รับการแก้ไข",
    criteria: "เรื่องร้องเรียนต้องได้รับการแก้ไขร้อยละ 100",
    target: { value: 100, direction: "max" },
    kind: "ratio_pair",
    numerator: { key: "complaint_resolved", label: "จำนวนข้อร้องเรียนที่แก้ไขสำเร็จ" },
    denominator: { key: "complaint_total", label: "จำนวนข้อร้องเรียนทั้งหมด" },
  },
  {
    id: "safety",
    name: "ความปลอดภัยทางห้องปฏิบัติการ รายงานอุบัติเหตุทางการแพทย์ อุบัติการณ์ที่เกี่ยวข้องกับความปลอดภัยทางห้องปฏิบัติการ",
    criteria: "รายงานอุบัติเหตุทางการแพทย์ อุบัติการณ์ที่เกี่ยวข้องกับความปลอดภัยทางห้องปฏิบัติการต้องเกิดขึ้นไม่เกิน 2 ครั้งต่อปี",
    kind: "incident",
    countField: { key: "safety_incident_count", label: "จำนวนรายงานอุบัติเหตุทางการแพทย์" },
    checkboxField: { key: "safety_review_done", label: "รอบทบทวนสำเร็จ" },
  },
];

/** Build the indicator list with the "pm" indicator's `groups` replaced by
 * a live, admin-managed list of PM machines (lib/sheets-pm-machines.ts) —
 * so adding/renaming/retiring a machine never needs a code change. Falls
 * back to the original hardcoded `KPI_INDICATORS` when `groups` is empty
 * (sheet not set up yet, or unreachable), so the app behaves exactly as it
 * did before this feature existed. */
export function withPmGroups(groups: { key: string; label: string }[]): KpiIndicator[] {
  if (groups.length === 0) return KPI_INDICATORS;
  return KPI_INDICATORS.map((indicator) => (indicator.kind === "pm" ? { ...indicator, groups } : indicator));
}

/** The 3 generic shapes an admin-added custom KPI indicator can take —
 * deliberately a subset of the full KpiIndicator union. "ratio_auto" (reads
 * the attendance total automatically) and "pm" (nested device groups) are
 * hospital-specific enough that they stay code-defined only; these 3 cover
 * the common cases a new quality indicator is likely to need. */
export type CustomKpiIndicatorConfig = {
  id: string;
  name: string;
  shortName: string;
  criteria: string;
  kind: "direct_percent" | "ratio_pair" | "incident";
  field1Label: string;
  field2Label: string;
  targetValue: number | null;
  targetDirection: "max" | "min" | "";
  decimals: number | null;
};

/** Builds a real KpiIndicator from an admin-entered custom definition. Field
 * keys are derived from `id` (e.g. "<id>_pct") rather than admin-typed text,
 * so they stay safe Sheet column identifiers regardless of what the admin
 * types as a label — same reasoning as PM machines' `key`. `id` is fixed
 * once created (never editable afterward), so renaming name/shortName/
 * criteria/labels later is always safe: it never touches the stable field
 * keys that past months' data in the "ตัวชี้วัด" sheet are keyed by. */
export function buildCustomKpiIndicator(row: CustomKpiIndicatorConfig): KpiIndicator {
  const target: KpiTarget | undefined =
    row.targetValue != null && (row.targetDirection === "max" || row.targetDirection === "min")
      ? { value: row.targetValue, direction: row.targetDirection }
      : undefined;
  const common = {
    id: row.id,
    name: row.name || row.id,
    shortName: row.shortName || undefined,
    criteria: row.criteria,
    decimals: row.decimals ?? undefined,
    target,
  };
  switch (row.kind) {
    case "direct_percent":
      return { ...common, kind: "direct_percent", field: { key: `${row.id}_pct`, label: row.field1Label || "ค่า (%)" } };
    case "ratio_pair":
      return {
        ...common,
        kind: "ratio_pair",
        numerator: { key: `${row.id}_num`, label: row.field1Label || "จำนวนที่ผ่านเกณฑ์" },
        denominator: { key: `${row.id}_den`, label: row.field2Label || "จำนวนทั้งหมด" },
      };
    case "incident":
      return {
        ...common,
        kind: "incident",
        countField: { key: `${row.id}_count`, label: row.field1Label || "จำนวนอุบัติการณ์" },
        checkboxField: { key: `${row.id}_done`, label: row.field2Label || "ดำเนินการแล้ว" },
      };
  }
}

type KpiIndicatorConfigLike = {
  id: string;
  kind: "" | "direct_percent" | "ratio_pair" | "incident";
  order: number;
  active: boolean;
} & Omit<CustomKpiIndicatorConfig, "id" | "kind">;

/** Applies the admin-managed "ตัวชี้วัดคุณภาพ (ตั้งค่า)" config on top of the
 * indicator list (already PM-group-merged via withPmGroups): any of the 6
 * original indicators gets its active/order from a matching config row when
 * one exists, and any config row whose id isn't one of the 6 becomes a new
 * custom indicator (see buildCustomKpiIndicator). Falls back to `base`
 * completely unchanged when there are no config rows at all (sheet not set
 * up yet, or unreachable).
 *
 * `includeInactive` keeps deactivated indicators in the result instead of
 * dropping them — used for server-side save validation only, so a save
 * already in flight when an admin deactivates an indicator mid-session
 * isn't rejected as "invalid indicator" (same reasoning as PM machines'
 * read-all-not-just-active validation in app/api/kpi/route.ts). */
export function withKpiIndicatorConfig(
  base: KpiIndicator[],
  configRows: KpiIndicatorConfigLike[],
  opts: { includeInactive?: boolean } = {}
): KpiIndicator[] {
  if (configRows.length === 0) return base;
  const cfgById = new Map(configRows.map((r) => [r.id, r]));
  const baseIds = new Set(base.map((b) => b.id));
  const entries: { indicator: KpiIndicator; order: number }[] = [];

  base.forEach((indicator, i) => {
    const cfg = cfgById.get(indicator.id);
    if (!opts.includeInactive && cfg && !cfg.active) return;
    entries.push({ indicator, order: cfg ? cfg.order : i });
  });

  configRows
    .filter((r) => !baseIds.has(r.id) && r.kind !== "" && (opts.includeInactive || r.active))
    .forEach((r) => {
      entries.push({
        indicator: buildCustomKpiIndicator({ ...r, kind: r.kind as "direct_percent" | "ratio_pair" | "incident" }),
        order: r.order,
      });
    });

  entries.sort((a, b) => a.order - b.order);
  return entries.map((e) => e.indicator);
}

export type KpiFieldType = "count" | "percent" | "boolean";

/** What kind of value a given (indicator, field) holds — used for
 * server-side save validation so a bogus or formula-injected value can
 * never reach the sheet regardless of what the client sends. Returns null
 * for a field name that doesn't belong to that indicator at all. */
export function kpiFieldType(indicator: KpiIndicator, field: string): KpiFieldType | null {
  switch (indicator.kind) {
    case "ratio_auto":
      return field === indicator.numerator.key ? "count" : null;
    case "ratio_editable":
      if (field === indicator.numerator.key || field === indicator.denominator.key) return "count";
      if (indicator.directField && field === indicator.directField.key) return "percent";
      return null;
    case "ratio_pair":
      return field === indicator.numerator.key || field === indicator.denominator.key ? "count" : null;
    case "direct_percent":
      return field === indicator.field.key ? "percent" : null;
    case "pm":
      for (const g of indicator.groups) {
        if (field === `${g.key}_pending`) return "boolean";
        if (field === `${g.key}_success` || field === `${g.key}_total`) return "count";
      }
      return null;
    case "incident":
      if (field === indicator.countField.key) return "count";
      if (field === indicator.checkboxField.key) return "boolean";
      return null;
  }
}

// Fiscal year (Thai government convention): Oct–Sep, named after the
// calendar year it ends in. e.g. Oct 2568–Sep 2569 = ปีงบประมาณ 2569.
export function fiscalYearOf(calendarYear: number, month1to12: number): number {
  return month1to12 >= 10 ? calendarYear + 1 : calendarYear;
}

// 12 (year, month) pairs for a given fiscal year, in Oct..Sep order.
export function fiscalYearMonths(fiscalYear: number): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  for (const m of [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const year = m >= 10 ? fiscalYear - 1 : fiscalYear;
    months.push({ year, month: m });
  }
  return months;
}

/** How many of a fiscal year's 12 months have at least one row in `rows`.
 * Used for the "กรอกแล้ว X/12 เดือน" completeness badge on entry forms —
 * works for any record shape (KPI, attendance, TAT) since it only reads
 * the shared year/month fields. */
export function fiscalYearMonthsFilled(rows: { year: number; month: number }[], fiscalYear: number): number {
  const present = new Set(rows.map((r) => `${r.year}-${r.month}`));
  return fiscalYearMonths(fiscalYear).filter(({ year, month }) => present.has(`${year}-${month}`)).length;
}
