import { KpiIndicator } from "./constants";
import { RecordRow, monthTotal } from "./aggregate";
import { kpiMonthResult, getNumber, getBool, KpiRecordRow } from "./aggregate-kpi";

// Shared row-building logic for the Excel-mirrored KPI table — used by both
// the on-page KpiYearTable component and the server-side Excel export, so
// the two can never drift apart.

export type Cell = { text: string; className?: string; status?: "pass" | "fail" | "pending" | null };
// "valueKind" tells a consumer (the Excel export, in particular) how to
// treat a row's cell text as a real value rather than a display string:
// "percent" cells are a number with a % sign, "count" cells are a plain
// integer (possibly with thousands separators), "status" cells are the
// literal text PASS/FAIL/"-" (no numeric meaning).
export type Row = {
  label: string;
  indent?: boolean;
  bold?: boolean;
  cells: Cell[];
  total: Cell;
  valueKind: "percent" | "count" | "status";
  decimals?: number;
};

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return null;
  return present.reduce((s, v) => s + v, 0);
}

function pctCell(pct: number | null, decimals: number, status?: "pass" | "fail" | "pending" | null): Cell {
  if (status === "pending") return { text: "รอทำสัญญา", className: "text-base-content/40", status };
  const className =
    status === "fail" ? "text-error" : status === "pass" ? "text-success" : "text-base-content/70";
  return { text: pct == null ? "-" : `${pct.toFixed(decimals)}%`, className, status: status ?? null };
}

function countCell(n: number | null): Cell {
  return { text: n == null ? "-" : n.toLocaleString() };
}

/** Weighted total %: sum(numerators) / sum(denominators), the same way each
 * month's own % is computed — not an average-of-percentages, so a handful of
 * low-volume months don't get the same weight as a high-volume one. */
function weightedPctTotal(numSum: number | null, denSum: number | null, decimals: number): Cell {
  if (numSum == null || denSum == null) return { text: "-" };
  if (denSum === 0) return { text: "-" };
  return { text: `${((numSum / denSum) * 100).toFixed(decimals)}%` };
}

function averagePctTotal(values: (number | null)[], decimals: number): Cell {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return { text: "-" };
  const avg = present.reduce((s, v) => s + v, 0) / present.length;
  return { text: `${avg.toFixed(decimals)}%` };
}

/** Builds the Excel-mirrored row set for one indicator: a bold headline %/
 * status row, followed by the same raw-count sub-rows the hospital's own
 * sheet shows underneath it (indented, same labels as the entry form). */
export function buildIndicatorRows(
  indicator: KpiIndicator,
  records: KpiRecordRow[],
  attendance: RecordRow[],
  months: { year: number; month: number }[]
): Row[] {
  const decimals = indicator.decimals ?? 1;
  const rows: Row[] = [];

  switch (indicator.kind) {
    case "ratio_auto": {
      const headCells = months.map(({ year, month }) => {
        const r = kpiMonthResult(indicator, records, attendance, year, month);
        return pctCell(r.pct, decimals, r.status);
      });
      const numVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.numerator.key));
      const denVals = months.map(({ year, month }) => monthTotal(attendance, year, month));
      rows.push({
        label: indicator.name,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        label: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        label: "จำนวนผู้รับบริการทั้งหมด",
        indent: true,
        cells: denVals.map(countCell),
        total: countCell(sumOrNull(denVals)),
        valueKind: "count",
      });
      break;
    }

    case "ratio_editable": {
      const headCells = months.map(({ year, month }) => {
        const r = kpiMonthResult(indicator, records, attendance, year, month);
        return pctCell(r.pct, decimals, r.status);
      });
      const numVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.numerator.key));
      const denVals = months.map(({ year, month }) => {
        const stored = getNumber(records, year, month, indicator.id, indicator.denominator.key);
        return stored ?? monthTotal(attendance, year, month);
      });
      rows.push({
        label: indicator.name,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        label: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        label: indicator.denominator.label,
        indent: true,
        cells: denVals.map(countCell),
        total: countCell(sumOrNull(denVals)),
        valueKind: "count",
      });
      break;
    }

    case "ratio_pair": {
      const headCells = months.map(({ year, month }) => {
        const r = kpiMonthResult(indicator, records, attendance, year, month);
        return pctCell(r.pct, decimals, r.status);
      });
      const numVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.numerator.key));
      const denVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.denominator.key));
      rows.push({
        label: indicator.name,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        label: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        label: indicator.denominator.label,
        indent: true,
        cells: denVals.map(countCell),
        total: countCell(sumOrNull(denVals)),
        valueKind: "count",
      });
      break;
    }

    case "direct_percent": {
      const pctVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.field.key));
      rows.push({
        label: indicator.name,
        bold: true,
        cells: pctVals.map((v) => pctCell(v, decimals)),
        total: averagePctTotal(pctVals, decimals),
        valueKind: "percent",
        decimals,
      });
      break;
    }

    case "pm": {
      // Overall headline = plain average of each group's own %, same as
      // kpiMonthResult's "active groups average" rule.
      const headCells = months.map(({ year, month }) => {
        const r = kpiMonthResult(indicator, records, attendance, year, month);
        return pctCell(r.pct, decimals, null);
      });
      const monthlyActivePcts = months.map(({ year, month }) => {
        const r = kpiMonthResult(indicator, records, attendance, year, month);
        return r.pct;
      });
      rows.push({
        label: indicator.name,
        bold: true,
        cells: headCells,
        total: averagePctTotal(monthlyActivePcts, decimals),
        valueKind: "percent",
        decimals,
      });

      for (const g of indicator.groups) {
        const pendingVals = months.map(({ year, month }) => getBool(records, year, month, indicator.id, `${g.key}_pending`));
        const successVals = months.map(({ year, month }, i) =>
          pendingVals[i] ? null : getNumber(records, year, month, indicator.id, `${g.key}_success`)
        );
        const totalVals = months.map(({ year, month }, i) =>
          pendingVals[i] ? null : getNumber(records, year, month, indicator.id, `${g.key}_total`)
        );
        const groupPctCells = months.map((_, i) => {
          if (pendingVals[i]) return { text: "รอทำสัญญา", className: "text-base-content/40", status: "pending" as const };
          const s = successVals[i];
          const t = totalVals[i];
          const pct = s != null && t != null && t > 0 ? (s / t) * 100 : null;
          return { text: pct == null ? "-" : `${pct.toFixed(decimals)}%` };
        });
        const allPending = pendingVals.every(Boolean);
        const pendingCell: Cell = { text: "รอทำสัญญา", className: "text-base-content/40", status: "pending" };
        rows.push({
          label: `ร้อยละ PM/CAL (${g.label})`,
          indent: true,
          cells: groupPctCells,
          total: allPending ? pendingCell : weightedPctTotal(sumOrNull(successVals), sumOrNull(totalVals), decimals),
          valueKind: "percent",
          decimals,
        });
        rows.push({
          label: `${g.label} · จำนวนเครื่องที่ทำ PM และ CAL ที่ผ่าน`,
          indent: true,
          cells: months.map((_, i) => (pendingVals[i] ? pendingCell : countCell(successVals[i]))),
          total: allPending ? pendingCell : countCell(sumOrNull(successVals)),
          valueKind: "count",
        });
        rows.push({
          label: `${g.label} · จำนวนเครื่องที่ทำ PM และ CAL ทั้งหมด`,
          indent: true,
          cells: months.map((_, i) => (pendingVals[i] ? pendingCell : countCell(totalVals[i]))),
          total: allPending ? pendingCell : countCell(sumOrNull(totalVals)),
          valueKind: "count",
        });
      }
      break;
    }

    case "incident": {
      const counts = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.countField.key));
      const statusCells = counts.map((c): Cell => {
        if (c == null) return { text: "-" };
        return c === 0
          ? { text: "PASS", className: "text-success font-semibold", status: "pass" }
          : { text: "FAIL", className: "text-error font-semibold", status: "fail" };
      });
      const countSum = sumOrNull(counts);
      rows.push({
        label: indicator.name,
        bold: true,
        cells: statusCells,
        total:
          countSum == null
            ? { text: "-" }
            : countSum === 0
              ? { text: "PASS", className: "text-success font-semibold", status: "pass" }
              : { text: "FAIL", className: "text-error font-semibold", status: "fail" },
        valueKind: "status",
      });
      rows.push({
        label: indicator.countField.label,
        indent: true,
        cells: counts.map(countCell),
        total: countCell(countSum),
        valueKind: "count",
      });
      break;
    }
  }

  return rows;
}
