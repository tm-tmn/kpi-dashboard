import { PATIENT_TYPE_PAIRS } from "./constants";
import { getSheetsClient, getSheetId } from "./google-client";

const SHEET_NAME = "ข้อมูลดิบ";
// Data rows start at row 2 (row 1 is the header).
const FIRST_DATA_ROW = 2;

export type SheetRecord = {
  row: number; // 1-based row number in the sheet (for updates)
  year: number;
  month: number;
  point: string;
  type: string;
  count: number;
};

async function getClient() {
  return getSheetsClient();
}

/** Read every data row from "ข้อมูลดิบ". Used by both the dashboard and
 * the entry form (to pre-fill an existing month). */
export async function readAllRecords(): Promise<SheetRecord[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:F`,
  });
  const rows = res.data.values ?? [];
  const records: SheetRecord[] = [];
  rows.forEach((row, idx) => {
    const [yearRaw, monthRaw, , point, type, countRaw] = row;
    if (!yearRaw || !monthRaw || !point || !type) return;
    records.push({
      row: FIRST_DATA_ROW + idx,
      year: Number(yearRaw),
      month: Number(monthRaw),
      point: String(point).trim(),
      type: String(type).trim(),
      count: Number(countRaw ?? 0),
    });
  });
  return records;
}

/** Save one month's worth of entries (up to 17 rows). Existing rows for
 * that (year, month, point, type) are updated in place; missing ones are
 * appended. Safe to call repeatedly for the same month (idempotent). */
export async function saveMonth(
  year: number,
  month: number,
  entries: { point: string; type: string; count: number }[]
): Promise<void> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const existing = await readAllRecords();

  const keyOf = (p: string, t: string) => `${p}|||${t}`;
  const existingByKey = new Map<string, SheetRecord>();
  for (const rec of existing) {
    if (rec.year === year && rec.month === month) {
      existingByKey.set(keyOf(rec.point, rec.type), rec);
    }
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: (string | number)[][] = [];

  for (const entry of entries) {
    const match = existingByKey.get(keyOf(entry.point, entry.type));
    if (match) {
      updates.push({
        range: `${SHEET_NAME}!F${match.row}`,
        values: [[entry.count]],
      });
    } else {
      appends.push([
        year,
        month,
        `=TEXT(DATE(A${"?"},B${"?"},1),"mmmm")`, // placeholder, fixed below
        entry.point,
        entry.type,
        entry.count,
      ]);
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  if (appends.length > 0) {
    // We need real row numbers for the month-name formula, so append in
    // one batch starting right after the current last row.
    const lastRow = existing.reduce(
      (max, r) => Math.max(max, r.row),
      FIRST_DATA_ROW - 1
    );
    const fixedAppends = appends.map((row, i) => {
      const r = lastRow + 1 + i;
      return [
        row[0],
        row[1],
        `=TEXT(DATE(A${r},B${r},1),"mmmm")`,
        row[3],
        row[4],
        row[5],
      ];
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:F`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: fixedAppends },
    });
  }
}

/** Convenience: all valid (point, type) pairs, same order as the sheet. */
export function allPairs() {
  return PATIENT_TYPE_PAIRS;
}
