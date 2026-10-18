import { KpiIndicator, fiscalYearMonths, MONTH_ABBR_TH } from "./constants";
import { RecordRow, monthTotal } from "./aggregate";

export type KpiRecordRow = {
  year: number;
  month: number;
  indicator: string;
  field: string;
  value: string;
};

// Exported too — the Excel-mirrored year table (KpiYearTable) needs the same
// raw-field access to render each indicator's underlying count rows, not
// just the headline % this module otherwise returns.
export function getRaw(records: KpiRecordRow[], year: number, month: number, indicator: string, field: string) {
  return records.find(
    (r) => r.year === year && r.month === month && r.indicator === indicator && r.field === field
  )?.value;
}

export function getNumber(records: KpiRecordRow[], year: number, month: number, indicator: string, field: string) {
  const raw = getRaw(records, year, month, indicator, field);
  const n = raw == null || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function getBool(records: KpiRecordRow[], year: number, month: number, indicator: string, field: string) {
  const raw = getRaw(records, year, month, indicator, field);
  return raw === "TRUE" || raw === "true" || raw === "1";
}

export type KpiMonthResult = {
  indicator: KpiIndicator;
  /** Headline percentage to show, or null if not computable (e.g. zero denominator). */
  pct: number | null;
  /** Free-form status label, e.g. "PASS" / "FAIL" / "รอทำสัญญา" / null when not applicable. */
  status: "pass" | "fail" | "pending" | null;
  /** Secondary detail lines for the card (e.g. per-PM-group breakdown). */
  detail: { label: string; pct: number | null; status: "pass" | "fail" | "pending" | null }[];
};

/** Compute one indicator's result for a single (year, month), given the KPI
 * sheet rows and (for the two auto/pre-filled denominators) the attendance
 * records to pull the service-point grand total from. */
export function kpiMonthResult(
  indicator: KpiIndicator,
  kpiRecords: KpiRecordRow[],
  attendanceRecords: RecordRow[],
  year: number,
  month: number
): KpiMonthResult {
  switch (indicator.kind) {
    case "ratio_auto": {
      const num = getNumber(kpiRecords, year, month, indicator.id, indicator.numerator.key);
      const den = monthTotal(attendanceRecords, year, month);
      const pct = num != null && den > 0 ? (num / den) * 100 : null;
      return { indicator, pct, status: null, detail: [] };
    }
    case "ratio_editable": {
      const num = getNumber(kpiRecords, year, month, indicator.id, indicator.numerator.key);
      const denStored = getNumber(kpiRecords, year, month, indicator.id, indicator.denominator.key);
      const den = denStored ?? monthTotal(attendanceRecords, year, month);
      const computed = num != null && den > 0 ? (num / den) * 100 : null;
      // Falls back to a directly-typed % for months with no backing counts
      // (the hospital's own Excel does this too — some months have a literal
      // % with no counts at all). Counts win whenever they're available.
      const direct = indicator.directField
        ? getNumber(kpiRecords, year, month, indicator.id, indicator.directField.key)
        : null;
      const pct = computed ?? direct;
      return { indicator, pct, status: null, detail: [] };
    }
    case "ratio_pair": {
      const num = getNumber(kpiRecords, year, month, indicator.id, indicator.numerator.key);
      const den = getNumber(kpiRecords, year, month, indicator.id, indicator.denominator.key);
      const pct = num != null && den != null && den > 0 ? (num / den) * 100 : den === 0 ? 100 : null;
      return { indicator, pct, status: null, detail: [] };
    }
    case "direct_percent": {
      const pct = getNumber(kpiRecords, year, month, indicator.id, indicator.field.key);
      return { indicator, pct, status: null, detail: [] };
    }
    case "pm": {
      const detail = indicator.groups.map((g) => {
        const pending = getBool(kpiRecords, year, month, indicator.id, `${g.key}_pending`);
        if (pending) return { label: g.label, pct: null, status: "pending" as const };
        const success = getNumber(kpiRecords, year, month, indicator.id, `${g.key}_success`);
        const total = getNumber(kpiRecords, year, month, indicator.id, `${g.key}_total`);
        const pct = success != null && total != null && total > 0 ? (success / total) * 100 : null;
        const status: "pass" | "fail" | null = pct == null ? null : pct >= 100 ? "pass" : "fail";
        return { label: g.label, pct, status };
      });
      const active = detail.filter((d) => d.pct != null);
      const pct = active.length ? active.reduce((s, d) => s + (d.pct ?? 0), 0) / active.length : null;
      return { indicator, pct, status: null, detail };
    }
    case "incident": {
      const count = getNumber(kpiRecords, year, month, indicator.id, indicator.countField.key);
      const reviewDone = getBool(kpiRecords, year, month, indicator.id, indicator.checkboxField.key);
      const status: "pass" | "fail" | null = count == null ? null : count === 0 ? "pass" : "fail";
      return {
        indicator,
        pct: count == null ? null : count === 0 ? 100 : 0,
        status,
        detail: [{ label: indicator.checkboxField.label, pct: null, status: reviewDone ? "pass" : "pending" }],
      };
    }
  }
}

/** All fiscal years that have at least one KPI row. */
export function availableKpiYears(records: KpiRecordRow[]): number[] {
  const set = new Set<number>();
  for (const r of records) {
    set.add(r.month >= 10 ? r.year + 1 : r.year);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Fiscal-year (Oct..Sep) trend of one indicator's headline % for charting. */
export function kpiYearTrend(
  indicator: KpiIndicator,
  kpiRecords: KpiRecordRow[],
  attendanceRecords: RecordRow[],
  fiscalYear: number
) {
  const months = fiscalYearMonths(fiscalYear);
  const labels = [MONTH_ABBR_TH[9], MONTH_ABBR_TH[10], MONTH_ABBR_TH[11], ...MONTH_ABBR_TH.slice(0, 9)];
  return months.map(({ year, month }, i) => {
    const result = kpiMonthResult(indicator, kpiRecords, attendanceRecords, year, month);
    return { month: labels[i], pct: result.pct, status: result.status };
  });
}
