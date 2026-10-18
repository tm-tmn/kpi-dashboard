import ExcelJS from "exceljs";
import { SERVICE_POINTS, TAT_STAGES, TAT_STAGE_META, MONTH_ABBR_TH } from "./constants";
import { TatRecordRow, tatYearTable } from "./aggregate-tat";
import { pointMeta } from "./point-meta";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9DCE3" } },
  left: { style: "thin", color: { argb: "FFD9DCE3" } },
  bottom: { style: "thin", color: { argb: "FFD9DCE3" } },
  right: { style: "thin", color: { argb: "FFD9DCE3" } },
};

const TITLE = "ตาราง TAT ทั้งปี (รายเดือน)";
const TOTAL_COLS = 1 + 12 + 1; // จุดบริการ/ขั้นตอน + 12 months + เฉลี่ยทั้งปี

/** Mirrors TatYearTable.tsx 1:1 — one row per (จุดบริการ, ขั้นตอน), Jan..Dec
 * columns, a yearly-average column, and the "รวมทั้งหมด" stage bolded in
 * its own accent color — built from the same tatYearTable() the on-screen
 * table uses so the two can never disagree. */
export async function buildTatWorkbook(records: TatRecordRow[], year: number): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KPI Dashboard";
  wb.created = new Date();
  const ws = wb.addWorksheet("TAT", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2, rightToLeft: false }],
  });

  ws.columns = [{ width: 34 }, ...MONTH_ABBR_TH.map(() => ({ width: 9 })), { width: 13 }];

  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${TITLE} — ${year}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8B5CF6" } };
  ws.getRow(1).height = 26;

  const headerLabels = ["จุดบริการ / ขั้นตอน", ...MONTH_ABBR_TH, "เฉลี่ยทั้งปี"];
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

  const rows = tatYearTable(records, year, SERVICE_POINTS, TAT_STAGES);
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!grouped.has(row.point)) grouped.set(row.point, []);
    grouped.get(row.point)!.push(row);
  }

  let r = 3;
  for (const point of SERVICE_POINTS) {
    const meta = pointMeta(point);
    const pointRows = grouped.get(point) ?? [];
    for (const row of pointRows) {
      const stageMeta = TAT_STAGE_META[row.stage as keyof typeof TAT_STAGE_META];
      const excelRow = ws.getRow(r);

      const labelCell = excelRow.getCell(1);
      labelCell.value = `${meta.short} · ${row.stage}`;
      labelCell.font = {
        bold: stageMeta.total,
        color: stageMeta.total ? { argb: "FF0E9F6E" } : { argb: "FF374151" },
      };
      labelCell.alignment = { horizontal: "left", vertical: "middle" };
      labelCell.border = THIN_BORDER;

      row.values.forEach((v, i) => {
        const cell = excelRow.getCell(2 + i);
        if (v != null) {
          cell.value = v;
          cell.numFmt = "0.00";
        } else {
          cell.value = "-";
          cell.font = { color: { argb: "FFB0B4BD" } };
        }
        cell.alignment = { horizontal: "right", vertical: "middle" };
        cell.border = THIN_BORDER;
        if (stageMeta.total) cell.font = { ...(cell.font ?? {}), bold: true };
      });

      const avgCell = excelRow.getCell(2 + 12);
      if (row.avg != null) {
        avgCell.value = row.avg;
        avgCell.numFmt = "0.00";
      } else {
        avgCell.value = "-";
        avgCell.font = { color: { argb: "FFB0B4BD" } };
      }
      avgCell.alignment = { horizontal: "right", vertical: "middle" };
      avgCell.border = THIN_BORDER;
      avgCell.font = { ...(avgCell.font ?? {}), bold: true };
      avgCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };

      if (stageMeta.total) {
        excelRow.eachCell((c) => {
          c.fill = c.fill ?? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6FBF8" } };
        });
      }

      r += 1;
    }
  }

  return wb;
}
