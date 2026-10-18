import legacyData from "./legacy-data.json";
import { fiscalYearMonths, MONTH_ABBR_TH } from "./constants";

export type RecordRow = {
  year: number;
  month: number;
  point: string;
  type: string;
  count: number;
};

export type LegacyYear = { year: number; months: number[] };

export function getLegacyYears(): LegacyYear[] {
  return legacyData as LegacyYear[];
}

/** All fiscal years that have at least one row in the live records. */
export function availableFiscalYears(records: RecordRow[]): number[] {
  const set = new Set<number>();
  for (const r of records) {
    const fy = r.month >= 10 ? r.year + 1 : r.year;
    set.add(fy);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** Sum of `count` for a given (year, month), across all points/types.
 * Exported so other domains (e.g. KPI indicators) can pull the attendance
 * total for a month without duplicating the filter/reduce. */
export function monthTotal(records: RecordRow[], year: number, month: number): number {
  return records
    .filter((r) => r.year === year && r.month === month)
    .reduce((s, r) => s + r.count, 0);
}

/** Monthly totals (Oct..Sep) for one fiscal year, broken down by จุดบริการ. */
export function fiscalYearByPoint(records: RecordRow[], fiscalYear: number, points: readonly string[]) {
  const months = fiscalYearMonths(fiscalYear);
  return points.map((point) => {
    const values = months.map(({ year, month }) =>
      records
        .filter((r) => r.year === year && r.month === month && r.point === point)
        .reduce((s, r) => s + r.count, 0)
    );
    return { point, values, total: values.reduce((a, b) => a + b, 0) };
  });
}

/** Breakdown by ประเภทผู้รับบริการ within one จุดบริการ, for a fiscal year. */
export function fiscalYearByType(records: RecordRow[], fiscalYear: number, point: string) {
  const months = fiscalYearMonths(fiscalYear);
  const types = Array.from(
    new Set(records.filter((r) => r.point === point).map((r) => r.type))
  );
  return types
    .map((type) => {
      const total = months.reduce(
        (s, { year, month }) =>
          s +
          records
            .filter((r) => r.year === year && r.month === month && r.point === point && r.type === type)
            .reduce((a, b) => a + b.count, 0),
        0
      );
      return { type, total };
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Full year-at-a-glance table: one row per (จุดบริการ, ประเภท), monthly
 * values Oct..Sep plus a yearly total. Powers the read-only summary table
 * on the entry page so the user doesn't need to flip month-by-month. */
export function fiscalYearTable(
  records: RecordRow[],
  fiscalYear: number,
  pairs: { point: string; type: string }[]
) {
  const months = fiscalYearMonths(fiscalYear);
  return pairs.map(({ point, type }) => {
    const values = months.map(({ year, month }) =>
      records
        .filter((r) => r.year === year && r.month === month && r.point === point && r.type === type)
        .reduce((s, r) => s + r.count, 0)
    );
    return { point, type, values, total: values.reduce((a, b) => a + b, 0) };
  });
}

export function fiscalMonthLabels() {
  // Oct..Sep abbreviations
  return [MONTH_ABBR_TH[9], MONTH_ABBR_TH[10], MONTH_ABBR_TH[11], ...MONTH_ABBR_TH.slice(0, 9)];
}

/** Combined yearly trend: legacy (static) years + live years computed from
 * records, keyed by calendar ปี พ.ศ., with month-by-month totals and YoY %. */
export function yearlyTrend(records: RecordRow[]) {
  const legacy = getLegacyYears();
  const liveYears = Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b);

  const rows: { year: number; months: number[]; total: number }[] = legacy.map((y) => ({
    year: y.year,
    months: y.months,
    total: y.months.reduce((a, b) => a + b, 0),
  }));

  for (const year of liveYears) {
    if (rows.some((r) => r.year === year)) continue;
    const months = Array.from({ length: 12 }, (_, i) => monthTotal(records, year, i + 1));
    rows.push({ year, months, total: months.reduce((a, b) => a + b, 0) });
  }

  rows.sort((a, b) => a.year - b.year);

  return rows.map((row, i) => {
    const prev = i > 0 ? rows[i - 1].total : 0;
    const pctChange = prev > 0 ? ((row.total - prev) / prev) * 100 : null;
    return { ...row, pctChange };
  });
}
