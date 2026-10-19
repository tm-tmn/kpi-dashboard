import { NextRequest, NextResponse } from "next/server";
import { readAllKpiRecords, saveKpiMonth } from "@/lib/sheets-kpi";
import { withPmGroups, kpiFieldType } from "@/lib/constants";
import { readAllPmMachines } from "@/lib/sheets-pm-machines";

// Same pattern as /api/records and /api/tat — live read on every GET, no
// prerendering/caching.

export async function GET() {
  try {
    const records = await readAllKpiRecords();
    return NextResponse.json({ records });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { year, month, entries } = body as {
      year: number;
      month: number;
      entries: { indicator: string; field: string; value: string | number | boolean }[];
    };

    if (!year || !month || !Array.isArray(entries)) {
      return NextResponse.json(
        { error: "ข้อมูลไม่ครบ: ต้องมี year, month, entries" },
        { status: 400 }
      );
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "เดือนไม่ถูกต้อง: ต้องเป็น 1-12" }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 2400 || year > 2700) {
      return NextResponse.json({ error: "ปี พ.ศ. ไม่ถูกต้อง" }, { status: 400 });
    }

    // Validate against every configured machine (active or retired), not
    // just the active ones the entry form currently renders — so a save
    // already in flight when an admin retires a machine mid-session doesn't
    // get rejected as "invalid field".
    const pmMachines = await readAllPmMachines();
    const indicators = withPmGroups(pmMachines.map((m) => ({ key: m.key, label: m.label })));
    const indicatorById = new Map(indicators.map((k) => [k.id, k]));
    // Each entry's value is checked against what that specific field is
    // allowed to hold (count / percent / boolean) rather than passed through
    // as-is — this both rejects nonsense (e.g. 150% satisfaction, a negative
    // count) and closes the formula-injection vector a raw string value would
    // otherwise open (a leading "=" is never valid for any of these types).
    for (const e of entries) {
      const indicator = indicatorById.get(e.indicator);
      if (!indicator) {
        return NextResponse.json({ error: `ตัวชี้วัดไม่ถูกต้อง: ${e.indicator}` }, { status: 400 });
      }
      if (!e.field || typeof e.field !== "string") {
        return NextResponse.json({ error: `รายการย่อยไม่ถูกต้องสำหรับ ${e.indicator}` }, { status: 400 });
      }
      const fieldType = kpiFieldType(indicator, e.field);
      if (!fieldType) {
        return NextResponse.json({ error: `รายการย่อยไม่ถูกต้องสำหรับ ${e.indicator}: ${e.field}` }, { status: 400 });
      }
      if (fieldType === "boolean") {
        const v = typeof e.value === "boolean" ? (e.value ? "TRUE" : "FALSE") : String(e.value).toUpperCase();
        if (v !== "TRUE" && v !== "FALSE") {
          return NextResponse.json({ error: `ค่าต้องเป็น TRUE/FALSE สำหรับ ${e.indicator}.${e.field}` }, { status: 400 });
        }
      } else {
        const n = typeof e.value === "number" ? e.value : Number(e.value);
        if (!Number.isFinite(n)) {
          return NextResponse.json({ error: `ค่าต้องเป็นตัวเลขสำหรับ ${e.indicator}.${e.field}` }, { status: 400 });
        }
        if (n < 0) {
          return NextResponse.json({ error: `ค่าต้องไม่ติดลบสำหรับ ${e.indicator}.${e.field}` }, { status: 400 });
        }
        if (fieldType === "percent" && n > 100) {
          return NextResponse.json({ error: `เปอร์เซ็นต์ต้องไม่เกิน 100 สำหรับ ${e.indicator}.${e.field}` }, { status: 400 });
        }
        if (fieldType === "count" && n > 1_000_000) {
          return NextResponse.json({ error: `จำนวนสูงเกินจริงสำหรับ ${e.indicator}.${e.field}` }, { status: 400 });
        }
      }
    }

    await saveKpiMonth(year, month, entries);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
