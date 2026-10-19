import { TAT_STAGES, MONTH_ABBR_TH, type TatStage } from "./constants";

export type TatRecordRow = {
  year: number;
  month: number;
  point: string;
  stage: string;
  minutes: number;
};

/** All calendar ปี พ.ศ. that have at least one TAT row. TAT is tracked by
 * calendar year (Jan-Dec), unlike the attendance data's Oct-Sep fiscal year. */
export function availableTatYears(records: TatRecordRow[]): number[] {
  return Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b);
}

export function tatMonthLabels() {
  return MONTH_ABBR_TH;
}

/** For one จุดบริการ in one calendar year: one series per TAT stage, values
 * Jan..Dec (null where there's no data yet, so the line chart shows a gap
 * instead of dropping to zero). */
export function tatSeriesByPoint(records: TatRecordRow[], year: number, point: string) {
  return TAT_STAGES.map((stage) => {
    const values = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const row = records.find(
        (r) => r.year === year && r.month === month && r.point === point && r.stage === stage
      );
      return row ? row.minutes : null;
    });
    return { stage: stage as TatStage, values };
  });
}

/** Full year-at-a-glance table: one row per (จุดบริการ, ขั้นตอน), monthly
 * values Jan..Dec (null = no data yet) plus a yearly average. */
export function tatYearTable(
  records: TatRecordRow[],
  year: number,
  points: readonly string[],
  stages: readonly string[]
) {
  return points.flatMap((point) =>
    stages.map((stage) => {
      const values = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const row = records.find(
          (r) => r.year === year && r.month === month && r.point === point && r.stage === stage
        );
        return row ? row.minutes : null;
      });
      const nonNull = values.filter((v): v is number => v != null);
      const avg = nonNull.length ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null;
      return { point, stage, values, avg };
    })
  );
}

/** Latest month's "รวมทั้งหมด" (overall TAT) per จุดบริการ, for a quick
 * headline stat row. Falls back to the most recent month with any data. */
export function latestOverallTatByPoint(
  records: TatRecordRow[],
  year: number,
  points: readonly string[]
) {
  const totalStage: TatStage = "รวมทั้งหมด (ออกคิว - ปิดงาน)";
  return points.map((point) => {
    const rows = records
      .filter((r) => r.year === year && r.point === point && r.stage === totalStage)
      .sort((a, b) => b.month - a.month);
    return { point, minutes: rows[0]?.minutes ?? null, month: rows[0]?.month ?? null };
  });
}

/** Every stage's minutes for every จุดบริการ in one single (year, month) —
 * the side-by-side comparison, as opposed to tatSeriesByPoint's one-point-
 * at-a-time trend over a year. null where that point/stage wasn't entered
 * for the month. */
export function tatByPointForMonth(
  records: TatRecordRow[],
  year: number,
  month: number,
  points: readonly string[],
  stages: readonly string[]
) {
  return points.map((point) => {
    const row: { point: string } & Record<string, number | null | string> = { point };
    for (const stage of stages) {
      const rec = records.find(
        (r) => r.year === year && r.month === month && r.point === point && r.stage === stage
      );
      row[stage] = rec ? rec.minutes : null;
    }
    return row;
  });
}
