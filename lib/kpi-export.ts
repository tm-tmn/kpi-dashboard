import ExcelJS from "exceljs";
import { KPI_INDICATORS, MONTH_ABBR_TH, fiscalYearMonths, KpiIndicator } from "./constants";
import { RecordRow } from "./aggregate";
import { KpiRecordRow } from "./aggregate-kpi";
import { buildIndicatorRows, Row } from "./kpi-table";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9DCE3" } },
  left: { style: "thin", color: { argb: "FFD9DCE3" } },
  bottom: { style: "thin", color: { argb: "FFD9DCE3" } },
  right: { style: "thin", color: { argb: "FFD9DCE3" } },
};

const TITLE = "สรุปตัวชี้วัดคุณภาพหน่วยเจาะเลือดเก็บสิ่งส่งตรวจและ POCT";
const TOTAL_COLS = 3 + 12 + 1; // ลำดับ, ตัวชี้วัด, เกณฑ์ประเมิน + 12 months + รวม

/** Parses a Row/Cell's already-formatted display text back into a real
 * numeric value + Excel number format, so the exported file holds live
 * numbers (sortable, usable in formulas) rather than plain display text —
 * same structure the dashboard/entry-form table shows, built from the same
 * buildIndicatorRows so the two can never disagree. */
function writeValueCell(
  cell: ExcelJS.Cell,
  text: string,
  valueKind: Row["valueKind"],
  decimals: number | undefined,
  status?: "pass" | "fail" | "pending" | null
) {
  if (status === "pending" || text === "รอทำสัญญา") {
    cell.value = "รอทำสัญญา";
    cell.font = { italic: true, color: { argb: "FF9AA0AC" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    return;
  }
  if (text === "-") {
    cell.value = "-";
    cell.font = { color: { argb: "FFB0B4BD" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    return;
  }
  if (valueKind === "status") {
    cell.value = text; // "PASS" / "FAIL"
    cell.font = {
      bold: true,
      color: { argb: text === "PASS" ? "FF1B8A5A" : "FFD92D20" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    return;
  }
  if (valueKind === "percent") {
    const n = Number(text.replace("%", ""));
    if (Number.isFinite(n)) {
      cell.value = n / 100;
      cell.numFmt = `0.${"0".repeat(decimals ?? 1)}%`;
    } else {
      cell.value = text;
    }
    cell.alignment = { horizontal: "right", vertical: "middle" };
    return;
  }
  // count
  const n = Number(text.replace(/,/g, ""));
  if (Number.isFinite(n)) {
    cell.value = n;
    cell.numFmt = "#,##0";
  } else {
    cell.value = text;
  }
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

export async function buildKpiWorkbook(
  kpiRecords: KpiRecordRow[],
  attendance: RecordRow[],
  fiscalYear: number,
  indicators: KpiIndicator[] = KPI_INDICATORS
): Promise<ExcelJS.Workbook> {
  const months = fiscalYearMonths(fiscalYear);
  const monthLabels = months.map(({ year, month }) => `${MONTH_ABBR_TH[month - 1]} ${String(year).slice(-2)}`);

  const wb = new ExcelJS.Workbook();
  wb.creator = "KPI Dashboard";
  wb.created = new Date();
  const ws = wb.addWorksheet("สรุปตัวชี้วัด", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 2, rightToLeft: false }],
  });

  ws.columns = [
    { width: 7 },
    { width: 44 },
    { width: 40 },
    ...monthLabels.map(() => ({ width: 11 })),
    { width: 13 },
  ];

  // Title row
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${TITLE} — ปีงบประมาณ ${fiscalYear}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B8A5A" } };
  ws.getRow(1).height = 26;

  // Header row
  const headerLabels = ["ลำดับที่", "ตัวชี้วัด", "เกณฑ์ประเมิน", ...monthLabels, "รวม"];
  const headerRow = ws.getRow(2);
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: "FF374151" } };
    cell.alignment = { horizontal: i < 3 ? "left" : "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 30;

  let r = 3;
  indicators.forEach((indicator, idx) => {
    const rows = buildIndicatorRows(indicator, kpiRecords, attendance, months);
    const startRow = r;

    // Column B ("ตัวชี้วัด") merges down per name/group entity — matches the
    // real file's A6/B7:B9/B10:B12-style nested merges (the PM indicator has
    // more than one name entity per block; every other indicator has one).
    let nameBlockStart: number | null = null;
    let nameBlockSpan = 0;

    rows.forEach((row) => {
      const excelRow = ws.getRow(r);

      // ลำดับที่ — merged across the whole indicator block, written once below.
      const idxCell = excelRow.getCell(1);
      idxCell.border = THIN_BORDER;

      const nameCell = excelRow.getCell(2);
      nameCell.border = THIN_BORDER;
      nameCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      if (row.nameLabel) {
        nameCell.value = row.nameLabel;
        nameCell.font = { bold: true };
        nameBlockStart = r;
        nameBlockSpan = row.nameSpan ?? 1;
      }

      const descCell = excelRow.getCell(3);
      descCell.value = row.desc;
      descCell.font = row.bold ? { color: { argb: "FF374151" } } : { color: { argb: "FF6B7280" }, italic: true };
      descCell.alignment = {
        horizontal: "left",
        vertical: "middle",
        indent: row.indent ? 1 : 0,
        wrapText: true,
      };
      descCell.border = THIN_BORDER;

      row.cells.forEach((cell, i) => {
        const excelCell = excelRow.getCell(4 + i);
        if (row.valueKind !== "blank") {
          writeValueCell(excelCell, cell.text, row.valueKind, row.decimals, cell.status);
        }
        excelCell.border = THIN_BORDER;
      });

      const totalCell = excelRow.getCell(4 + months.length);
      if (row.valueKind !== "blank") {
        writeValueCell(totalCell, row.total.text, row.valueKind, row.decimals, row.total.status);
        totalCell.font = { ...(totalCell.font ?? {}), bold: true };
      }
      totalCell.border = THIN_BORDER;
      totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };

      if (row.bold) {
        excelRow.eachCell((c) => {
          c.fill = c.fill ?? { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBFBFB" } };
        });
      }

      // Close out the current name-merge block once its last row is written.
      if (nameBlockStart !== null && r === nameBlockStart + nameBlockSpan - 1) {
        if (nameBlockSpan > 1) ws.mergeCells(nameBlockStart, 2, r, 2);
        nameBlockStart = null;
      }

      r += 1;
    });

    if (rows.length > 1) {
      ws.mergeCells(startRow, 1, r - 1, 1);
    }
    const firstIdxCell = ws.getCell(startRow, 1);
    firstIdxCell.value = idx + 1;
    firstIdxCell.font = { bold: true };
    firstIdxCell.alignment = { horizontal: "center", vertical: "middle" };
  });

  return wb;
}
