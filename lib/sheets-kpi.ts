import { getSheetsClient, getSheetId } from "./google-client";

// Same spreadsheet as "ข้อมูลดิบ" / "TAT", separate tab. See SETUP.md ข้อ 7
// for how to create this tab. Long format, one row per (ปี, เดือน, ตัวชี้วัด,
// รายการย่อย) — flexible enough to hold the 6 differently-shaped indicators
// (ratios, direct percentages, PM groups, incident counts/checkboxes)
// without a wide, mostly-empty spreadsheet.
const SHEET_NAME = "ตัวชี้วัด";
const FIRST_DATA_ROW = 2;

export type KpiSheetRecord = {
  row: number;
  year: number;
  month: number;
  indicator: string;
  field: string;
  value: string;
};

async function getClient() {
  return getSheetsClient();
}

/** Read every row from the "ตัวชี้วัด" tab. */
export async function readAllKpiRecords(): Promise<KpiSheetRecord[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:F`,
  });
  const rows = res.data.values ?? [];
  const records: KpiSheetRecord[] = [];
  rows.forEach((row, idx) => {
    const [yearRaw, monthRaw, , indicator, field, valueRaw] = row;
    if (!yearRaw || !monthRaw || !indicator || !field) return;
    records.push({
      row: FIRST_DATA_ROW + idx,
      year: Number(yearRaw),
      month: Number(monthRaw),
      indicator: String(indicator).trim(),
      field: String(field).trim(),
      value: valueRaw == null ? "" : String(valueRaw),
    });
  });
  return records;
}

/** Save one month's worth of KPI entries. Same upsert-by-key pattern as
 * lib/sheets.ts / lib/sheets-tat.ts: existing (indicator, field) rows for
 * that month are updated in place, new ones are appended. */
export async function saveKpiMonth(
  year: number,
  month: number,
  entries: { indicator: string; field: string; value: string | number | boolean }[]
): Promise<void> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const existing = await readAllKpiRecords();

  const keyOf = (i: string, f: string) => `${i}|||${f}`;
  const existingByKey = new Map<string, KpiSheetRecord>();
  for (const rec of existing) {
    if (rec.year === year && rec.month === month) {
      existingByKey.set(keyOf(rec.indicator, rec.field), rec);
    }
  }

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const appends: { indicator: string; field: string; value: string | number | boolean }[] = [];

  for (const entry of entries) {
    const match = existingByKey.get(keyOf(entry.indicator, entry.field));
    const value = typeof entry.value === "boolean" ? (entry.value ? "TRUE" : "FALSE") : entry.value;
    if (match) {
      updates.push({
        range: `${SHEET_NAME}!F${match.row}`,
        values: [[value]],
      });
    } else {
      appends.push({ ...entry, value });
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
        entry.indicator,
        entry.field,
        entry.value as string | number,
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
