import { getSheetsClient, getSheetId } from "./google-client";
import { SERVICE_POINTS, PATIENT_TYPE_PAIRS } from "./constants";

// Configurable จุดบริการ (service points, e.g. "ห้องเจาะเลือด OPD") and the
// ประเภทผู้รับบริการ (patient-type rows) nested under each — shared by both
// the "จำนวนผู้รับบริการ" and "TAT" entry forms (they always use the same
// points). Two tabs in the same spreadsheet as everything else. See
// SETUP.md ข้อ 9 for how to create them.
const POINTS_SHEET = "จุดบริการ";
const TYPES_SHEET = "ประเภทผู้รับบริการ";
const FIRST_DATA_ROW = 2;

export type ServicePointRow = { row: number; point: string; order: number; active: boolean };
export type PatientTypeRow = { row: number; point: string; type: string; order: number; active: boolean };

// Used when the tabs don't exist yet or are empty — keeps the app working
// exactly as it did before this feature shipped.
export const DEFAULT_SERVICE_POINTS: ServicePointRow[] = SERVICE_POINTS.map((point, i) => ({
  row: -1,
  point,
  order: i + 1,
  active: true,
}));
export const DEFAULT_PATIENT_TYPE_PAIRS: PatientTypeRow[] = PATIENT_TYPE_PAIRS.map((p, i) => ({
  row: -1,
  point: p.point,
  type: p.type,
  order: i + 1,
  active: true,
}));

async function getClient() {
  return getSheetsClient();
}

function isMissingSheetError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Google's own wording when a range names a tab that doesn't exist yet —
  // treated the same as "no rows yet" rather than surfaced as an error,
  // since these tabs are optional and most hospitals won't have created
  // them (the app falls back to the original hardcoded points/types).
  return message.includes("Unable to parse range");
}

export async function readAllServicePoints(): Promise<ServicePointRow[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${POINTS_SHEET}!A${FIRST_DATA_ROW}:C`,
    });
  } catch (err) {
    if (isMissingSheetError(err)) return [];
    throw err;
  }
  const rows = res.data.values ?? [];
  const points: ServicePointRow[] = [];
  rows.forEach((row, idx) => {
    const [pointRaw, orderRaw, activeRaw] = row;
    if (!pointRaw) return;
    points.push({
      row: FIRST_DATA_ROW + idx,
      point: String(pointRaw).trim(),
      order: orderRaw != null && orderRaw !== "" && Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : idx,
      active: activeRaw == null || activeRaw === "" ? true : String(activeRaw).toUpperCase() === "TRUE",
    });
  });
  return points.sort((a, b) => a.order - b.order);
}

export async function readAllPatientTypes(): Promise<PatientTypeRow[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${TYPES_SHEET}!A${FIRST_DATA_ROW}:D`,
    });
  } catch (err) {
    if (isMissingSheetError(err)) return [];
    throw err;
  }
  const rows = res.data.values ?? [];
  const types: PatientTypeRow[] = [];
  rows.forEach((row, idx) => {
    const [pointRaw, typeRaw, orderRaw, activeRaw] = row;
    if (!pointRaw || !typeRaw) return;
    types.push({
      row: FIRST_DATA_ROW + idx,
      point: String(pointRaw).trim(),
      type: String(typeRaw).trim(),
      order: orderRaw != null && orderRaw !== "" && Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : idx,
      active: activeRaw == null || activeRaw === "" ? true : String(activeRaw).toUpperCase() === "TRUE",
    });
  });
  return types.sort((a, b) => a.order - b.order);
}

/** Overwrite both tabs with the given lists, in the given order. Same
 * whole-tab-overwrite approach as lib/sheets-pm-machines.ts — simplest safe
 * option for a short admin-managed list. Renaming a point/type here only
 * changes the label used for entries going forward: existing rows in
 * "ข้อมูลดิบ" / "TAT" that were saved under the old text are NOT rewritten,
 * so they keep showing under their original name (see SETUP.md ข้อ 9). */
export async function saveServicePointsConfig(
  points: { point: string; active: boolean }[],
  pairs: { point: string; type: string; active: boolean }[]
): Promise<void> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();

  const clearAndWrite = async (sheetName: string, range: string, values: (string | number)[][]) => {
    try {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    } catch (err) {
      if (isMissingSheetError(err)) {
        throw new Error(
          `ยังไม่มีชีต "${sheetName}" ใน Google Sheet — สร้างแท็บนี้ก่อน (ดูวิธีใน SETUP.md ข้อ 9) แล้วค่อยบันทึกอีกครั้ง`
        );
      }
      throw err;
    }
    if (values.length === 0) return;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  };

  await clearAndWrite(
    POINTS_SHEET,
    `${POINTS_SHEET}!A${FIRST_DATA_ROW}:C`,
    points.map((p, i) => [p.point, i + 1, p.active ? "TRUE" : "FALSE"])
  );
  await clearAndWrite(
    TYPES_SHEET,
    `${TYPES_SHEET}!A${FIRST_DATA_ROW}:D`,
    pairs.map((p, i) => [p.point, p.type, i + 1, p.active ? "TRUE" : "FALSE"])
  );
}
