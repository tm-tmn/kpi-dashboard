import { NextRequest, NextResponse } from "next/server";
import { readAllKpiRecords, saveKpiMonth } from "@/lib/sheets-kpi";
import { KPI_INDICATORS } from "@/lib/constants";

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

    const validIndicatorIds = new Set(KPI_INDICATORS.map((k) => k.id));
    for (const e of entries) {
      if (!validIndicatorIds.has(e.indicator)) {
        return NextResponse.json({ error: `ตัวชี้วัดไม่ถูกต้อง: ${e.indicator}` }, { status: 400 });
      }
      if (!e.field || typeof e.field !== "string") {
        return NextResponse.json({ error: `รายการย่อยไม่ถูกต้องสำหรับ ${e.indicator}` }, { status: 400 });
      }
    }

    await saveKpiMonth(year, month, entries);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
