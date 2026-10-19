import { NextRequest, NextResponse } from "next/server";
import {
  readAllServicePoints,
  readAllPatientTypes,
  saveServicePointsConfig,
  DEFAULT_SERVICE_POINTS,
  DEFAULT_PATIENT_TYPE_PAIRS,
} from "@/lib/sheets-service-points";

// Same pattern as /api/pm-machines — public GET, POST gated behind the
// login session in proxy.ts. Manages both tabs (จุดบริการ / ประเภทผู้รับบริการ)
// together since the admin UI edits them as one nested list.

export async function GET() {
  try {
    const [points, pairs] = await Promise.all([readAllServicePoints(), readAllPatientTypes()]);
    return NextResponse.json({
      points: points.length > 0 ? points : DEFAULT_SERVICE_POINTS,
      pairs: pairs.length > 0 ? pairs : DEFAULT_PATIENT_TYPE_PAIRS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { points, pairs } = body as {
      points?: { point: string; active: boolean }[];
      pairs?: { point: string; type: string; active: boolean }[];
    };

    if (!Array.isArray(points) || points.length === 0) {
      return NextResponse.json({ error: "ต้องมีจุดบริการอย่างน้อย 1 จุด" }, { status: 400 });
    }
    if (!Array.isArray(pairs)) {
      return NextResponse.json({ error: "ข้อมูลประเภทผู้รับบริการไม่ถูกต้อง" }, { status: 400 });
    }

    const cleanedPoints: { point: string; active: boolean }[] = [];
    const seenPoints = new Set<string>();
    for (const p of points) {
      const point = String(p?.point ?? "").trim();
      if (!point) {
        return NextResponse.json({ error: "ชื่อจุดบริการต้องไม่ว่าง" }, { status: 400 });
      }
      if (seenPoints.has(point)) {
        return NextResponse.json({ error: `ชื่อจุดบริการซ้ำ: ${point}` }, { status: 400 });
      }
      seenPoints.add(point);
      cleanedPoints.push({ point, active: Boolean(p?.active) });
    }

    const cleanedPairs: { point: string; type: string; active: boolean }[] = [];
    const seenPairs = new Set<string>();
    for (const p of pairs) {
      const point = String(p?.point ?? "").trim();
      const type = String(p?.type ?? "").trim();
      if (!point || !seenPoints.has(point)) {
        return NextResponse.json({ error: `ประเภทผู้รับบริการอ้างอิงจุดบริการที่ไม่มีอยู่: "${point}"` }, { status: 400 });
      }
      if (!type) {
        return NextResponse.json({ error: `ต้องมีชื่อประเภทผู้รับบริการสำหรับจุด "${point}"` }, { status: 400 });
      }
      const key = `${point}|||${type}`;
      if (seenPairs.has(key)) {
        return NextResponse.json({ error: `ประเภทผู้รับบริการซ้ำ: ${point} / ${type}` }, { status: 400 });
      }
      seenPairs.add(key);
      cleanedPairs.push({ point, type, active: Boolean(p?.active) });
    }

    await saveServicePointsConfig(cleanedPoints, cleanedPairs);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
