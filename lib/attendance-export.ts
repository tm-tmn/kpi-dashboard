import ExcelJS from "exceljs";
import {
  PATIENT_TYPE_PAIRS as DEFAULT_PAIRS,
  SERVICE_POINTS as DEFAULT_POINTS,
  fiscalYearMonths,
  MONTH_ABBR_TH,
} from "./constants";
import { RecordRow, fiscalYearTable } from "./aggregate";
import { pointMeta } from "./point-meta";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9DCE3" } },
  left: { style: "thin", color: { argb: "FFD9DCE3" } },
  bottom: { style: "thin", color: { argb: "FFD9DCE3" } },
  right: { style: "thin", color: { argb: "FFD9DCE3" } },
};

const TITLE = "ตารางข้อมูลผู้รับบริการทั้งปี (รายเดือน)";
const TOTAL_COLS = 1 + 12 + 1; // จุดบริการ/ประเภท + 12 months + ยอดรวม

/** Mirrors AttendanceYearTable.tsx 1:1 — one row per (จุดบริการ, ประเภท),
 * Oct..Sep columns, a bold subtotal row per จุดบริการ, and a grand-total
 * row, built from the exact same fiscalYearTable() the on-screen table
 * uses so the two can never disagree. */
export async function buildAttendanceWorkbook(
  records: RecordRow[],
  fiscalYear: number,
  points: string[] = [...DEFAULT_POINTS],
  pairs: { point: string; type: string }[] = DEFAULT_PAIRS
): Promise<ExcelJS.Workbook> {
  const months = fiscalYearMonths(fiscalYear);
  const monthLabels = months.map(({ year, month }) => `${MONTH_ABBR_TH[month - 1]} ${String(year).slice(-2)}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "KPI Dashboard";
  wb.created = new Date();
  const ws = wb.addWorksheet("ข้อมูลผู้รับบริการ", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2, rightToLeft: false }],
  });

  ws.columns = [{ width: 32 }, ...monthLabels.map(() => ({ width: 11 })), { width: 13 }];

  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${TITLE} — ปีงบประมาณ ${fiscalYear}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B7FD6" } };
  ws.getRow(1).height = 26;

  const headerLabels = ["จุดบริการ / ประเภท", ...monthLabels, "ยอดรวม"];
  const headerRow = ws.getRow(2);
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: "FF374151" } };
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 26;

  const rows = fiscalYearTable(records, fiscalYear, pairs);
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!grouped.has(row.point)) grouped.set(row.point, []);
    grouped.get(row.point)!.push(row);
  }

  const writeNumberRow = (
    r: number,
    label: string,
    values: number[],
    total: number,
    opts: { bold?: boolean; color?: string; fill?: string } = {}
  ) => {
    const excelRow = ws.getRow(r);
    const labelCell = excelRow.getCell(1);
    labelCell.value = label;
    labelCell.font = { bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    labelCell.alignment = { horizontal: "left", vertical: "middle" };
    labelCell.border = THIN_BORDER;
    if (opts.fill) labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };

    values.forEach((v, i) => {
      const cell = excelRow.getCell(2 + i);
      cell.value = v;
      cell.numFmt = "#,##0";
      cell.font = { bold: opts.bold };
      cell.alignment = { horizontal: "right", vertical: "middle" };
      cell.border = THIN_BORDER;
      if (opts.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill } };
    });

    const totalCell = excelRow.getCell(2 + months.length);
    totalCell.value = total;
    totalCell.numFmt = "#,##0";
    totalCell.font = { bold: true };
    totalCell.alignment = { horizontal: "right", vertical: "middle" };
    totalCell.border = THIN_BORDER;
    totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.fill ?? "FFFAFAFA" } };
  };

  let r = 3;
  const grandTotalByMonth = months.map((_, i) => rows.reduce((s, row) => s + row.values[i], 0));
  const grandTotal = rows.reduce((s, row) => s + row.total, 0);

  for (const point of points) {
    const pointRows = grouped.get(point) ?? [];
    for (const row of pointRows) {
      writeNumberRow(r, `${pointMeta(point).short} · ${row.type}`, row.values, row.total);
      r += 1;
    }
    const subtotal = months.map((_, i) => pointRows.reduce((s, row) => s + row.values[i], 0));
    const subtotalSum = pointRows.reduce((s, row) => s + row.total, 0);
    writeNumberRow(r, `รวม - ${point}`, subtotal, subtotalSum, { bold: true, fill: "FFF3F4F6" });
    r += 1;
  }

  writeNumberRow(r, "รวมทั้งหมด", grandTotalByMonth, grandTotal, { bold: true, fill: "FFDCEBFC" });

  return wb;
}
