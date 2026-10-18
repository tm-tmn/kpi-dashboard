import { TAT_STAGES } from "./constants";
import { getSheetsClient, getSheetId } from "./google-client";

// Same spreadsheet as "ข้อมูลดิบ", separate tab. See SETUP.md ข้อ 6 for how
// to create this tab (header row + ready-to-paste historical data).
const SHEET_NAME = "TAT";
const FIRST_DATA_ROW = 2;

export type TatSheetRecord = {
  row: number;
  year: number;
  month: number;
  point: string;
  stage: string;
  minutes: number;
};

async function getClient() {
  return getSheetsClient();
}

/** Read every row from the "TAT" tab. */
export async function readAllTatRecords(): Promise<TatSheetRecord[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:F`,
  });
  const rows = res.data.values ?? [];
  const records: TatSheetRecord[] = [];
  rows.forEach((row, idx) => {
    const [yearRaw, monthRaw, , point, stage, minutesRaw] = row;
    if (!yearRaw || !monthRaw || !point || !stage) return;
    records.push({
      row: FIRST_DATA_ROW + idx,
      year: Number(yearRaw),
      month: Number(monthRaw),
      point: String(point).trim(),
      stage: String(stage).trim(),
      minutes: Number(minutesRaw ?? 0),
    });
  });
  return records;
}

/** Save one month's worth of TAT entries (4 points x 4 stages = 16 rows).
 * Same upsert-by-key pattern as lib/sheets.ts saveMonth. */
export async function saveTatMonth(
  year: number,
  month: number,
  entries: { point: string; stage: string; minutes: number }[]
): Promise<void> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const existing = await readAllTatRecords();

  const keyOf = (p: string, s: string) => `${p}|||${s}`;
  const existingByKey = new Map<string, TatSheetRecord>();
  for (const rec of existing) {
    if (rec.year === year && rec.month === month) {
      existingByKey.set(keyOf(rec.point, rec.stage), rec);
    }
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: { point: string; stage: string; minutes: number }[] = [];

  for (const entry of entries) {
    const match = existingByKey.get(keyOf(entry.point, entry.stage));
    if (match) {
      updates.push({
        range: `${SHEET_NAME}!F${match.row}`,
        values: [[entry.minutes]],
      });
    } else {
      appends.push(entry);
    }
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: updates },
    });
  }

  if (appends.length > 0) {
    const lastRow = existing.reduce(
      (max, r) => Math.max(max, r.row),
      FIRST_DATA_ROW - 1
    );
    const fixedAppends = appends.map((entry, i) => {
      const r = lastRow + 1 + i;
      return [
        year,
        month,
        `=TEXT(DATE(A${r},B${r},1),"mmmm")`,
        entry.point,
        entry.stage,
        entry.minutes,
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

export function allTatStages() {
  return TAT_STAGES;
}
