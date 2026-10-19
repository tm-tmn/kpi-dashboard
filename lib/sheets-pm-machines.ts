import { getSheetsClient, getSheetId } from "./google-client";

// Configurable PM-device groups for the "pm" KPI indicator (เครื่องจัดเตรียม
// หลอดเลือดอัตโนมัติ) — lets the hospital add/rename/retire machines without
// a code change. Same spreadsheet as the other tabs, separate tab. See
// SETUP.md ข้อ 8 for how to create this tab.
const SHEET_NAME = "เครื่อง PM";
const FIRST_DATA_ROW = 2;
const LAST_COL = "D";

export type PmMachine = {
  row: number;
  key: string;
  label: string;
  order: number;
  active: boolean;
};

// Used when the "เครื่อง PM" tab doesn't exist yet or is empty — keeps the
// app working exactly as it did before this feature shipped (the original 2
// hardcoded machines).
export const DEFAULT_PM_MACHINES: PmMachine[] = [
  { row: -1, key: "select", label: "SELECT", order: 1, active: true },
  { row: -1, key: "henm", label: "HEN M", order: 2, active: true },
];

async function getClient() {
  return getSheetsClient();
}

function isMissingSheetError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Google's own wording when a range names a tab that doesn't exist yet —
  // e.g. "Unable to parse range: เครื่อง PM!A2:D". Treated the same as "no
  // rows yet" (see DEFAULT_PM_MACHINES) rather than surfaced as an error,
  // since this tab is optional and most hospitals won't have created it.
  return message.includes("Unable to parse range");
}

/** Read every row from the "เครื่อง PM" tab, sorted by display order.
 * Returns [] (not an error) if the tab doesn't exist yet — the caller falls
 * back to DEFAULT_PM_MACHINES, same as an existing-but-empty tab. */
export async function readAllPmMachines(): Promise<PmMachine[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
    });
  } catch (err) {
    if (isMissingSheetError(err)) return [];
    throw err;
  }
  const rows = res.data.values ?? [];
  const machines: PmMachine[] = [];
  rows.forEach((row, idx) => {
    const [keyRaw, labelRaw, orderRaw, activeRaw] = row;
    if (!keyRaw || !labelRaw) return;
    machines.push({
      row: FIRST_DATA_ROW + idx,
      key: String(keyRaw).trim(),
      label: String(labelRaw).trim(),
      order: orderRaw != null && orderRaw !== "" && Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : idx,
      active: activeRaw == null || activeRaw === "" ? true : String(activeRaw).toUpperCase() === "TRUE",
    });
  });
  return machines.sort((a, b) => a.order - b.order);
}

/** Overwrite the whole tab with the given list, in the given order. Simplest
 * safe approach for a short admin-managed list (a handful of machines) —
 * avoids row-matching/upsert bookkeeping that a long-format sheet like
 * "ตัวชี้วัด" needs. Historical KPI rows that reference a machine's `key`
 * are never touched here — removing a machine from this tab only takes it
 * out of the active list; its past data stays in the "ตัวชี้วัด" tab. */
export async function savePmMachines(
  machines: { key: string; label: string; active: boolean }[]
): Promise<void> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
    });
  } catch (err) {
    if (isMissingSheetError(err)) {
      throw new Error(
        `ยังไม่มีชีต "${SHEET_NAME}" ใน Google Sheet — สร้างแท็บนี้ก่อน (ดูวิธีใน SETUP.md ข้อ 8) แล้วค่อยบันทึกรายการเครื่องอีกครั้ง`
      );
    }
    throw err;
  }

  if (machines.length === 0) return;

  // RAW (not USER_ENTERED): never interpreted as a formula.
  const values = machines.map((m, i) => [m.key, m.label, i + 1, m.active ? "TRUE" : "FALSE"]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}
