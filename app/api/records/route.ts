import { NextRequest, NextResponse } from "next/server";
import { readAllRecords, saveMonth } from "@/lib/sheets";
import { PATIENT_TYPE_PAIRS } from "@/lib/constants";

// No "use cache" here, and this reads live data from the Google Sheet API
// on every call, so Next.js already treats it as dynamic (not prerendered).

export async function GET() {
  try {
    const records = await readAllRecords();
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
      entries: { point: string; type: string; count: number }[];
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

    // Validate every entry is a known (point, type) pair, and count is a
    // non-negative number — never trust client input blindly.
    const validKeys = new Set(
      PATIENT_TYPE_PAIRS.map((p) => `${p.point}|||${p.type}`)
    );
    for (const e of entries) {
      const key = `${e.point}|||${e.type}`;
      if (!validKeys.has(key)) {
        return NextResponse.json(
          { error: `ประเภทไม่ถูกต้อง: ${e.point} / ${e.type}` },
          { status: 400 }
        );
      }
      if (typeof e.count !== "number" || e.count < 0 || !Number.isFinite(e.count) || e.count > 1_000_000) {
        return NextResponse.json(
          { error: `จำนวนไม่ถูกต้องสำหรับ ${e.type}` },
          { status: 400 }
        );
      }
    }

    await saveMonth(year, month, entries);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
