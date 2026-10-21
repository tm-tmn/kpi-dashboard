import { KpiIndicator, MONTH_NAMES_TH, MONTH_ABBR_TH, fiscalYearMonths } from "./constants";
import { RecordRow } from "./aggregate";
import { TatRecordRow } from "./aggregate-tat";
import { KpiRecordRow, kpiMonthResult, kpiStatus } from "./aggregate-kpi";
import { buildIndicatorRows } from "./kpi-table";

// Pure data model for the PDF report. Everything the PDF shows is computed
// here from the same records/aggregators the dashboard and Excel exports
// use, so the numbers in the three can never disagree.

export type ReportType = "month" | "fiscal" | "calendar";
export type YM = { year: number; month: number };

export type ReportRequest = {
  type: ReportType;
  /** ปี พ.ศ. — fiscal year for "fiscal", calendar year otherwise. */
  year: number;
  /** 1-12, only for "month". */
  month?: number;
  observations: string;
  preparer: { name: string; position: string };
  approver: { name: string; position: string };
};

export type Status = "pass" | "fail" | null;

export type ReportData = {
  title: string;
  periodLabel: string;
  compareLabel: string;
  annual: boolean;
  monthLabels: string[];
  attendance: {
    total: number;
    prevTotal: number | null;
    pct: number | null;
    monthsFilled: number;
    byPoint: {
      point: string;
      total: number;
      prev: number | null;
      pct: number | null;
      monthly: (number | null)[];
      types: { type: string; total: number }[];
    }[];
    monthlyTotals: (number | null)[];
  };
  tat: {
    stages: string[];
    rows: { point: string; values: (number | null)[]; prev: (number | null)[] }[];
    hasData: boolean;
  };
  kpi: {
    items: {
      name: string;
      criteria: string;
      target: string;
      value: string;
      status: Status;
      monthly: { text: string; status: Status }[];
    }[];
    passed: number;
    failed: number;
    unknown: number;
  };
  autoNotes: string[];
  observations: string;
  preparer: { name: string; position: string };
  approver: { name: string; position: string };
  generatedAt: string;
};

function periodMonths(req: ReportRequest): YM[] {
  if (req.type === "month") return [{ year: req.year, month: req.month ?? 1 }];
  if (req.type === "fiscal") return fiscalYearMonths(req.year);
  return Array.from({ length: 12 }, (_, i) => ({ year: req.year, month: i + 1 }));
}

function previousPeriod(req: ReportRequest): { months: YM[]; label: string } {
  if (req.type === "month") {
    const m = req.month ?? 1;
    const prev = m === 1 ? { year: req.year - 1, month: 12 } : { year: req.year, month: m - 1 };
    return { months: [prev], label: `${MONTH_NAMES_TH[prev.month - 1]} ${prev.year}` };
  }
  const prevReq = { ...req, year: req.year - 1 };
  return {
    months: periodMonths(prevReq),
    label: req.type === "fiscal" ? `ปีงบประมาณ ${req.year - 1}` : `ปี ${req.year - 1}`,
  };
}

const thStatus = (t: string) => (t === "PASS" ? "ผ่าน" : t === "FAIL" ? "ไม่ผ่าน" : t);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pctChange = (cur: number, prev: number | null) =>
  prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null;

function attendanceFor(records: RecordRow[], months: YM[], point?: string, type?: string) {
  const keys = new Set(months.map((m) => `${m.year}-${m.month}`));
  return records
    .filter((r) => keys.has(`${r.year}-${r.month}`) && (!point || r.point === point) && (!type || r.type === type))
    .reduce((s, r) => s + r.count, 0);
}

function monthHasAttendance(records: RecordRow[], m: YM) {
  return records.some((r) => r.year === m.year && r.month === m.month);
}

function tatAvg(records: TatRecordRow[], months: YM[], point: string, stage: string): number | null {
  const keys = new Set(months.map((m) => `${m.year}-${m.month}`));
  const vals = records
    .filter((r) => r.point === point && r.stage === stage && keys.has(`${r.year}-${r.month}`))
    .map((r) => r.minutes);
  return vals.length ? sum(vals) / vals.length : null;
}

function targetText(ind: KpiIndicator): string {
  if (ind.kind === "incident") return "0 ครั้ง";
  if (ind.kind === "pm") return "100%";
  if (!ind.target) return "-";
  return `${ind.target.direction === "min" ? "ไม่เกิน" : "ไม่น้อยกว่า"} ${ind.target.value}%`;
}

function statusFromText(ind: KpiIndicator, text: string, explicit?: Status | "pending" | null, pmGroup = false): Status {
  if (explicit === "pass" || explicit === "fail") return explicit;
  const n = parseFloat(text);
  if (!Number.isFinite(n) || !/%$/.test(text.trim())) return null;
  if (pmGroup) return n >= 100 ? "pass" : "fail";
  if (!ind.target) return null;
  return ind.target.direction === "min" ? (n <= ind.target.value ? "pass" : "fail") : n >= ind.target.value ? "pass" : "fail";
}

export function buildReportData(input: {
  req: ReportRequest;
  attendance: RecordRow[];
  tat: TatRecordRow[];
  kpiRecords: KpiRecordRow[];
  indicators: KpiIndicator[];
  points: string[];
  stages: string[];
  now?: Date;
}): ReportData {
  const { req, attendance, tat, kpiRecords, indicators, points, stages } = input;
  const annual = req.type !== "month";
  const months = periodMonths(req);
  const prev = previousPeriod(req);

  const periodLabel =
    req.type === "month"
      ? `เดือน${MONTH_NAMES_TH[(req.month ?? 1) - 1]} พ.ศ. ${req.year}`
      : req.type === "fiscal"
        ? `ปีงบประมาณ ${req.year} (ต.ค. ${req.year - 1} – ก.ย. ${req.year})`
        : `ปีปฏิทิน พ.ศ. ${req.year} (ม.ค. – ธ.ค.)`;
  const title = annual ? "รายงานสรุปผลการดำเนินงานประจำปี" : "รายงานสรุปผลการดำเนินงานประจำเดือน";

  const monthLabels = months.map((m) => MONTH_ABBR_TH[m.month - 1]);

  // ── Attendance ──
  const filledMonths = months.filter((m) => monthHasAttendance(attendance, m));
  const prevFilled = prev.months.some((m) => monthHasAttendance(attendance, m));
  const total = attendanceFor(attendance, months);
  const prevTotal = prevFilled ? attendanceFor(attendance, prev.months) : null;
  const byPoint = points.map((point) => {
    const t = attendanceFor(attendance, months, point);
    const p = prevFilled ? attendanceFor(attendance, prev.months, point) : null;
    const typeNames = Array.from(new Set(attendance.filter((r) => r.point === point).map((r) => r.type)));
    const types = typeNames
      .map((type) => ({ type, total: attendanceFor(attendance, months, point, type) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
    return {
      point,
      total: t,
      prev: p,
      pct: pctChange(t, p),
      monthly: months.map((m) => (monthHasAttendance(attendance, m) ? attendanceFor(attendance, [m], point) : null)),
      types,
    };
  });

  // ── TAT ──
  const tatRows = points.map((point) => ({
    point,
    values: stages.map((s) => tatAvg(tat, months, point, s)),
    prev: stages.map((s) => tatAvg(tat, prev.months, point, s)),
  }));
  const tatHas = tatRows.some((r) => r.values.some((v) => v != null));

  // ── KPI ──
  const items: ReportData["kpi"]["items"] = [];
  for (const ind of indicators) {
    const rows = buildIndicatorRows(ind, kpiRecords, attendance, months);
    if (ind.kind === "pm") {
      for (const r of rows) {
        if (r.valueKind !== "percent" || !r.nameLabel) continue;
        const monthly = r.cells.map((c) => ({
          text: c.text,
          status: statusFromText(ind, c.text, c.status, true),
        }));
        const value = annual ? r.total.text : r.cells[0]?.text ?? "-";
        items.push({
          name: `${ind.name} – ${r.nameLabel}`,
          criteria: ind.criteria,
          target: "100%",
          value,
          status: statusFromText(ind, value, null, true),
          monthly,
        });
      }
      continue;
    }
    const head = rows[0];
    if (!head) continue;
    const monthly = head.cells.map((c, i) => {
      let st: Status = null;
      if (ind.kind === "incident") st = c.status === "pass" || c.status === "fail" ? c.status : null;
      else {
        const res = kpiMonthResult(ind, kpiRecords, attendance, months[i].year, months[i].month);
        st = res.note ? null : kpiStatus(ind, res);
      }
      return { text: thStatus(c.text), status: st };
    });
    const value = thStatus(annual ? head.total.text : head.cells[0]?.text ?? "-");
    const status = annual
      ? ind.kind === "incident"
        ? head.total.status === "pass" || head.total.status === "fail"
          ? head.total.status
          : null
        : statusFromText(ind, value, null)
      : monthly[0]?.status ?? null;
    items.push({ name: ind.name, criteria: ind.criteria, target: targetText(ind), value, status, monthly });
  }
  const passed = items.filter((i) => i.status === "pass").length;
  const failed = items.filter((i) => i.status === "fail").length;

  // ── Auto notes ──
  const autoNotes: string[] = [];
  const fmt = (n: number) => n.toLocaleString("en-US");
  if (filledMonths.length === 0) {
    autoNotes.push("ยังไม่มีข้อมูลจำนวนผู้รับบริการในช่วงเวลานี้");
  } else {
    let s = `จำนวนผู้รับบริการรวม ${fmt(total)} ราย`;
    const pc = pctChange(total, prevTotal);
    if (pc != null) s += ` ${pc >= 0 ? "เพิ่มขึ้น" : "ลดลง"}ร้อยละ ${Math.abs(pc).toFixed(1)} เมื่อเทียบกับ${prev.label}`;
    autoNotes.push(s);
  }
  if (annual && filledMonths.length < 12) {
    autoNotes.push(`ข้อมูลจำนวนผู้รับบริการมี ${filledMonths.length} จาก 12 เดือน (เดือนที่ไม่มีข้อมูลแสดงเป็น “-” ไม่ใช่ศูนย์)`);
  }
  if (failed > 0) {
    autoNotes.push(`ตัวชี้วัดที่ไม่ผ่านเกณฑ์ ${failed} รายการ: ${items.filter((i) => i.status === "fail").map((i) => i.name).join(", ")}`);
  } else if (passed > 0) {
    autoNotes.push(`ตัวชี้วัดคุณภาพทุกรายการที่มีข้อมูล (${passed} รายการ) ผ่านเกณฑ์`);
  }

  return {
    title,
    periodLabel,
    compareLabel: prev.label,
    annual,
    monthLabels,
    attendance: {
      total,
      prevTotal,
      pct: pctChange(total, prevTotal),
      monthsFilled: filledMonths.length,
      byPoint,
      monthlyTotals: months.map((m) => (monthHasAttendance(attendance, m) ? attendanceFor(attendance, [m]) : null)),
    },
    tat: { stages, rows: tatRows, hasData: tatHas },
    kpi: { items, passed, failed, unknown: items.length - passed - failed },
    autoNotes,
    observations: req.observations.trim(),
    preparer: req.preparer,
    approver: req.approver,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
