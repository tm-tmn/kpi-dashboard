import { RecordRow } from "./aggregate";
import { TatRecordRow } from "./aggregate-tat";

const TOTAL_TAT_STAGE = "รวมทั้งหมด (ออกคิว - ปิดงาน)";

/** Pearson correlation coefficient, -1..1. Needs at least 3 points and some
 * spread on both axes (a constant series has no defined correlation) —
 * returns null when either condition isn't met rather than a misleading 0. */
export function pearsonR(points: { x: number; y: number }[]): number | null {
  const n = points.length;
  if (n < 3) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dy = p.y - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

export type TypeTatMonth = {
  year: number;
  month: number;
  /** This type's share of the point's total patients that month, 0-100. */
  sharePct: number;
  /** The point's overall ("รวมทั้งหมด") TAT that month, in minutes. */
  tatMinutes: number;
};

/** Every month where both a patient-count breakdown and a TAT total exist
 * for one (จุดบริการ, ประเภทผู้รับบริการ) pair — the two datasets only
 * share (point, month) as a key, since TAT isn't tracked per patient type,
 * so this joins them at that level rather than reshaping either sheet. */
export function typeTatSeries(
  attendance: RecordRow[],
  tatRecords: TatRecordRow[],
  point: string,
  type: string
): TypeTatMonth[] {
  const monthKeys = new Set(
    attendance.filter((r) => r.point === point).map((r) => `${r.year}-${r.month}`)
  );
  const rows: TypeTatMonth[] = [];
  for (const key of monthKeys) {
    const [year, month] = key.split("-").map(Number);
    const pointTotal = attendance
      .filter((r) => r.year === year && r.month === month && r.point === point)
      .reduce((s, r) => s + r.count, 0);
    if (pointTotal <= 0) continue;
    const typeCount = attendance
      .filter((r) => r.year === year && r.month === month && r.point === point && r.type === type)
      .reduce((s, r) => s + r.count, 0);
    const tatRow = tatRecords.find(
      (r) => r.year === year && r.month === month && r.point === point && r.stage === TOTAL_TAT_STAGE
    );
    if (!tatRow) continue;
    rows.push({ year, month, sharePct: (typeCount / pointTotal) * 100, tatMinutes: tatRow.minutes });
  }
  return rows.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
}

export type TypeTatCorrelation = {
  type: string;
  n: number;
  r: number | null;
  series: TypeTatMonth[];
};

/** r (and the underlying monthly series) for every ประเภทผู้รับบริการ at
 * one จุดบริการ, so the UI can rank "which patient type's share moves
 * together with this point's TAT" without recomputing the join per row. */
export function typeTatCorrelationsByPoint(
  attendance: RecordRow[],
  tatRecords: TatRecordRow[],
  point: string,
  types: string[]
): TypeTatCorrelation[] {
  return types.map((type) => {
    const series = typeTatSeries(attendance, tatRecords, point, type);
    const r = pearsonR(series.map((s) => ({ x: s.sharePct, y: s.tatMinutes })));
    return { type, n: series.length, r, series };
  });
}
