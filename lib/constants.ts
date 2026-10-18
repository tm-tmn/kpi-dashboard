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
