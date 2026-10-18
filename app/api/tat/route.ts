import { NextRequest, NextResponse } from "next/server";
import { readAllTatRecords, saveTatMonth } from "@/lib/sheets-tat";
import { SERVICE_POINTS, TAT_STAGES } from "@/lib/constants";

export async function GET() {
  try {
    const records = await readAllTatRecords();
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
      entries: { point: string; stage: string; minutes: number }[];
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

    const validPoints = new Set<string>(SERVICE_POINTS);
    const validStages = new Set<string>(TAT_STAGES);
    for (const e of entries) {
      if (!validPoints.has(e.point) || !validStages.has(e.stage)) {
        return NextResponse.json(
          { error: `ข้อมูลไม่ถูกต้อง: ${e.point} / ${e.stage}` },
          { status: 400 }
        );
      }
      if (typeof e.minutes !== "number" || e.minutes < 0 || !Number.isFinite(e.minutes) || e.minutes > 10_000) {
        return NextResponse.json(
          { error: `ค่า TAT ไม่ถูกต้องสำหรับ ${e.point} / ${e.stage}` },
          { status: 400 }
        );
      }
    }

    await saveTatMonth(year, month, entries);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
