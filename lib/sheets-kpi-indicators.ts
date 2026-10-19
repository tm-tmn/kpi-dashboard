import { getSheetsClient, getSheetId } from "./google-client";

// Admin-managed configuration for the "ตัวชี้วัดคุณภาพ" (KPI quality
// indicators) list: lets the hospital deactivate/reactivate any of the 6
// original indicators, or add a brand-new one, without a code change. One
// row per indicator this tab knows about:
//   - A row whose `id` matches one of the 6 hardcoded indicators in
//     lib/constants.ts (KPI_INDICATORS) is an OVERRIDE row — only `order`
//     and `active` are read from it; the other columns are ignored (the
//     indicator's own name/criteria/fields/target stay the hardcoded ones).
//   - A row whose `id` does NOT match one of those 6 is a CUSTOM indicator —
//     every column is read, and lib/constants.ts's withKpiIndicatorConfig()
//     builds a real KpiIndicator from it (see buildCustomKpiIndicator there).
// Same spreadsheet as the other tabs, separate tab. See SETUP.md ข้อ 10 for
// how to create this tab.
const SHEET_NAME = "ตัวชี้วัดคุณภาพ (ตั้งค่า)";
const FIRST_DATA_ROW = 2;
const LAST_COL = "L";

export type KpiIndicatorConfigRow = {
  row: number;
  id: string;
  /** Blank for an override row (one of the 6 hardcoded indicators). */
  name: string;
  shortName: string;
  criteria: string;
  /** "" for an override row — the kind stays whatever the hardcoded
   * indicator already is. */
  kind: "" | "direct_percent" | "ratio_pair" | "incident";
  /** direct_percent: the single field's label. ratio_pair: numerator's
   * label. incident: the count field's label. */
  field1Label: string;
  /** ratio_pair: denominator's label. incident: the checkbox field's label.
   * Unused for direct_percent. */
  field2Label: string;
  targetValue: number | null;
  targetDirection: "max" | "min" | "";
  decimals: number | null;
  order: number;
  active: boolean;
};

async function getClient() {
  return getSheetsClient();
}

function isMissingSheetError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Google's own wording when a range names a tab that doesn't exist yet.
  // Treated the same as "no rows yet" — this tab is optional, and most
  // hospitals won't have created it (the app works exactly as before with
  // no config rows at all).
  return message.includes("Unable to parse range");
}

/** Read every row from the "ตัวชี้วัดคุณภาพ (ตั้งค่า)" tab, sorted by display
 * order. Returns [] (not an error) if the tab doesn't exist yet or is
 * empty — the caller then uses the original hardcoded KPI_INDICATORS
 * unchanged. */
export async function readAllKpiIndicatorConfig(): Promise<KpiIndicatorConfigRow[]> {
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
  const out: KpiIndicatorConfigRow[] = [];
  rows.forEach((row, idx) => {
    const [
      idRaw, nameRaw, shortRaw, criteriaRaw, kindRaw,
      field1Raw, field2Raw, targetValueRaw, targetDirectionRaw, decimalsRaw,
      orderRaw, activeRaw,
    ] = row;
    const id = String(idRaw ?? "").trim();
    if (!id) return;
    const kindStr = String(kindRaw ?? "").trim();
    const kind = kindStr === "direct_percent" || kindStr === "ratio_pair" || kindStr === "incident" ? kindStr : "";
    const targetDirectionStr = String(targetDirectionRaw ?? "").trim();
    out.push({
      row: FIRST_DATA_ROW + idx,
      id,
      name: String(nameRaw ?? "").trim(),
      shortName: String(shortRaw ?? "").trim(),
      criteria: String(criteriaRaw ?? "").trim(),
      kind,
      field1Label: String(field1Raw ?? "").trim(),
      field2Label: String(field2Raw ?? "").trim(),
      targetValue:
        targetValueRaw != null && targetValueRaw !== "" && Number.isFinite(Number(targetValueRaw))
          ? Number(targetValueRaw)
          : null,
      targetDirection: targetDirectionStr === "max" || targetDirectionStr === "min" ? targetDirectionStr : "",
      decimals:
        decimalsRaw != null && decimalsRaw !== "" && Number.isFinite(Number(decimalsRaw)) ? Number(decimalsRaw) : null,
      order: orderRaw != null && orderRaw !== "" && Number.isFinite(Number(orderRaw)) ? Number(orderRaw) : idx,
      active: activeRaw == null || activeRaw === "" ? true : String(activeRaw).toUpperCase() === "TRUE",
    });
  });
  return out.sort((a, b) => a.order - b.order);
}

/** Overwrite the whole tab with the given list, in the given order — same
 * whole-tab-overwrite approach as "เครื่อง PM" and "จุดบริการ"/"ประเภทผู้รับบริการ"
 * (a short admin-managed list, not a long-format append-only sheet like
 * "ตัวชี้วัด" itself). Deactivating an indicator here never touches its past
 * rows in the "ตัวชี้วัด" sheet — it only drops out of the active
 * dashboard/entry-form list going forward. */
export async function saveKpiIndicatorConfig(rows: Omit<KpiIndicatorConfigRow, "row">[]): Promise<void> {
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
        `ยังไม่มีชีต "${SHEET_NAME}" ใน Google Sheet — สร้างแท็บนี้ก่อน (ดูวิธีใน SETUP.md ข้อ 10) แล้วค่อยบันทึกรายการตัวชี้วัดอีกครั้ง`
      );
    }
    throw err;
  }

  if (rows.length === 0) return;

  // RAW (not USER_ENTERED): never interpreted as a formula.
  const values = rows.map((r, i) => [
    r.id,
    r.name,
    r.shortName,
    r.criteria,
    r.kind,
    r.field1Label,
    r.field2Label,
    r.targetValue ?? "",
    r.targetDirection,
    r.decimals ?? "",
    i + 1,
    r.active ? "TRUE" : "FALSE",
  ]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:${LAST_COL}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}
