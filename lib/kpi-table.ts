import { KpiIndicator } from "./constants";
import { RecordRow, monthTotal } from "./aggregate";
import { kpiMonthResult, getNumber, getBool, KpiRecordRow } from "./aggregate-kpi";

// Shared row-building logic for the Excel-mirrored KPI table — used by both
// the on-page KpiYearTable component and the server-side Excel export, so
// the two can never drift apart.
//
// Column semantics mirror the hospital's own Excel file exactly:
//   - "ลำดับที่" (index) merges across an indicator's whole row block.
//   - "ตัวชี้วัด" (name) only holds text on the row that starts a name/group
//     entity (an indicator's own name, or — for the PM indicator — each
//     device group's name); it's merged down across "nameSpan" rows from
//     there and left blank on the rows it covers.
//   - "เกณฑ์ประเมิน" is NOT merged — every row has its own text: the full
//     evaluation-criteria sentence on an indicator's headline row, or that
//     row's own field description on every row beneath it (matching the
//     real file, which reuses this column for per-row descriptions).

export type Cell = { text: string; className?: string; status?: "pass" | "fail" | "pending" | null };
// "valueKind" tells a consumer (the Excel export, in particular) how to
// treat a row's cell text as a real value rather than a display string:
// "percent" cells are a number with a % sign, "count" cells are a plain
// integer (possibly with thousands separators), "status" cells are the
// literal text PASS/FAIL, "blank" rows carry no data at all (the PM
// indicator's own title row, matching the real file's empty header line).
export type Row = {
  /** Column B ("ตัวชี้วัด") text — only set on the row that starts a name
   * entity; omitted on rows the entity's span covers. */
  nameLabel?: string;
  /** How many rows (including this one) nameLabel spans/merges down. */
  nameSpan?: number;
  /** Column C ("เกณฑ์ประเมิน") text for this specific row. */
  desc: string;
  indent?: boolean;
  bold?: boolean;
  cells: Cell[];
  total: Cell;
  valueKind: "percent" | "count" | "status" | "blank";
  decimals?: number;
};

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (!present.length) return null;
  return present.reduce((s, v) => s + v, 0);
}

function pctCell(pct: number | null, decimals: number, status?: "pass" | "fail" | "pending" | null, note?: string): Cell {
  if (status === "pending") return { text: "รอทำสัญญา", className: "text-base-content/40", status };
  if (note) return { text: note, className: "text-base-content/40", status: null };
  const className =
    status === "fail" ? "text-error" : status === "pass" ? "text-success" : "text-base-content/70";
  return { text: pct == null ? "-" : `${pct.toFixed(decimals)}%`, className, status: status ?? null };
}

function countCell(n: number | null): Cell {
  return { text: n == null ? "-" : n.toLocaleString() };
}

function blankCells(n: number): Cell[] {
  return Array.from({ length: n }, () => ({ text: "" }));
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

/** Builds the Excel-mirrored row set for one indicator: a headline %/status
 * row followed by the same raw-count sub-rows the hospital's own sheet shows
 * underneath it (same field labels as the entry form, so the two always
 * agree). */
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
        nameLabel: indicator.name,
        nameSpan: 3,
        desc: indicator.criteria,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        desc: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        desc: "จำนวนผู้รับบริการทั้งหมด",
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
        nameLabel: indicator.name,
        nameSpan: 3,
        desc: indicator.criteria,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        desc: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        desc: indicator.denominator.label,
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
        return pctCell(r.pct, decimals, r.status, r.note);
      });
      const numVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.numerator.key));
      const denVals = months.map(({ year, month }) => getNumber(records, year, month, indicator.id, indicator.denominator.key));
      rows.push({
        nameLabel: indicator.name,
        nameSpan: 3,
        desc: indicator.criteria,
        bold: true,
        cells: headCells,
        total: weightedPctTotal(sumOrNull(numVals), sumOrNull(denVals), decimals),
        valueKind: "percent",
        decimals,
      });
      rows.push({
        desc: indicator.numerator.label,
        indent: true,
        cells: numVals.map(countCell),
        total: countCell(sumOrNull(numVals)),
        valueKind: "count",
      });
      rows.push({
        desc: indicator.denominator.label,
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
        nameLabel: indicator.name,
        nameSpan: 1,
        desc: indicator.criteria,
        bold: true,
        cells: pctVals.map((v) => pctCell(v, decimals)),
        total: averagePctTotal(pctVals, decimals),
        valueKind: "percent",
        decimals,
      });
      break;
    }

    case "pm": {
      // Title-only row: name + criteria, no data cells — matches the real
      // file's blank header line sitting above the per-group rows (no
      // overall average of SELECT+HEN M is computed there).
      rows.push({
        nameLabel: indicator.name,
        nameSpan: 1,
        desc: indicator.criteria,
        bold: true,
        cells: blankCells(months.length),
        total: { text: "" },
        valueKind: "blank",
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
          nameLabel: g.label,
          nameSpan: 3,
          desc: `ร้อยละ PM/CAL (${g.label})`,
          bold: true,
          cells: groupPctCells,
          total: allPending ? pendingCell : weightedPctTotal(sumOrNull(successVals), sumOrNull(totalVals), decimals),
          valueKind: "percent",
          decimals,
        });
        rows.push({
          desc: "จำนวนเครื่องที่ทำ PM และCAL ที่สำเร็จ",
          indent: true,
          cells: months.map((_, i) => (pendingVals[i] ? pendingCell : countCell(successVals[i]))),
          total: allPending ? pendingCell : countCell(sumOrNull(successVals)),
          valueKind: "count",
        });
        rows.push({
          desc: "จำนวนเครื่องที่ทำ PM และ CAL ทั้งหมด",
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
        nameLabel: indicator.name,
        nameSpan: 2,
        desc: indicator.criteria,
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
        desc: indicator.countField.label,
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
