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

export type KpiIndicator =
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "ratio_auto"; // denominator auto-pulled from attendance total, read-only
      numerator: KpiField;
    }
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "ratio_editable"; // denominator pre-filled from attendance total but editable
      numerator: KpiField;
      denominator: KpiField;
    }
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "ratio_pair"; // both numerator and denominator entered manually
      numerator: KpiField;
      denominator: KpiField;
    }
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "direct_percent"; // a single % value entered directly
      field: KpiField;
    }
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "pm"; // PM device groups: success count, total count, "pending contract" flag
      groups: { key: string; label: string }[];
    }
  | {
      id: string;
      name: string;
      criteria: string;
      kind: "incident"; // incident count (PASS if 0) + a yes/no checkbox
      countField: KpiField;
      checkboxField: KpiField;
    };

export const KPI_INDICATORS: KpiIndicator[] = [
  {
    id: "rejection",
    name: "อัตราการปฏิเสธสิ่งส่งตรวจ",
    criteria: "(ระบุเกณฑ์ประเมินตามไฟล์ต้นฉบับ — แก้ไขข้อความนี้ได้ใน lib/constants.ts)",
    kind: "ratio_auto",
    numerator: { key: "rejection_count", label: "จำนวนอุบัติการณ์การปฏิเสธสิ่งส่งตรวจ" },
  },
  {
    id: "pm",
    name: "PM เครื่องจัดเตรียมหลอดเลือดอัตโนมัติ",
    criteria: "(ระบุเกณฑ์ประเมินตามไฟล์ต้นฉบับ — แก้ไขข้อความนี้ได้ใน lib/constants.ts)",
    kind: "pm",
    groups: [
      { key: "select", label: "SELECT" },
      { key: "henm", label: "HEN M" },
    ],
  },
  {
    id: "tat30",
    name: "อัตราผู้รับบริการที่รอคอยไม่เกิน 30 นาที",
    criteria: "(ระบุเกณฑ์ประเมินตามไฟล์ต้นฉบับ — แก้ไขข้อความนี้ได้ใน lib/constants.ts)",
    kind: "ratio_editable",
    numerator: { key: "tat30_count", label: "จำนวนผู้รับบริการที่รอคอยไม่เกิน 30 นาที" },
    denominator: { key: "tat30_denominator", label: "จำนวนผู้รับบริการทั้งหมด (TAT)" },
  },
  {
    id: "satisfaction",
    name: "ความพึงพอใจของผู้รับบริการ",
    criteria: "(ระบุเกณฑ์ประเมินตามไฟล์ต้นฉบับ — แก้ไขข้อความนี้ได้ใน lib/constants.ts)",
    kind: "direct_percent",
    field: { key: "satisfaction_pct", label: "ร้อยละความพึงพอใจ" },
  },
  {
    id: "complaint",
    name: "เรื่องร้องเรียนได้รับการแก้ไข",
    criteria: "(ระบุเกณฑ์ประเมินตามไฟล์ต้นฉบับ — แก้ไขข้อความนี้ได้ใน lib/constants.ts)",
    kind: "ratio_pair",
    numerator: { key: "complaint_resolved", label: "จำนวนเรื่องร้องเรียนที่ได้รับการแก้ไข" },
    denominator: { key: "complaint_total", label: "จำนวนเรื่องร้องเรียนทั้งหมด" },
  },
  {
    id: "safety",
    name: "ความปลอดภัยทางห้องปฏิบัติการ",
    criteria: "PASS เมื่อไม่มีอุบัติการณ์ (0 ครั้ง) ในเดือนนั้น",
    kind: "incident",
    countField: { key: "safety_incident_count", label: "จำนวนอุบัติการณ์ด้านความปลอดภัย" },
    checkboxField: { key: "safety_review_done", label: "รอบทบทวนสำเร็จ" },
  },
];

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
