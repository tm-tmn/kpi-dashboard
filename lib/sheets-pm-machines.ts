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

/** Read every row from the "เครื่อง PM" tab, sorted by display order. */
export async function readAllPmMachines(): Promise<PmMachine[]> {
  const sheets = await getClient();
  const spreadsheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
  });
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

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
  });

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
