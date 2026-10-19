import { NextRequest, NextResponse } from "next/server";
import { readAllPmMachines, savePmMachines, DEFAULT_PM_MACHINES } from "@/lib/sheets-pm-machines";

// Same pattern as /api/records, /api/tat, /api/kpi — live read on every GET,
// no prerendering/caching. Public like /api/kpi GET; the POST (admin
// add/rename/retire) is gated behind the login session in proxy.ts.

export async function GET() {
  try {
    const machines = await readAllPmMachines();
    return NextResponse.json({ machines: machines.length > 0 ? machines : DEFAULT_PM_MACHINES });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { machines } = body as {
      machines?: { key: string; label: string; active: boolean }[];
    };

    if (!Array.isArray(machines) || machines.length === 0) {
      return NextResponse.json(
        { error: "ต้องมีรายการเครื่องอย่างน้อย 1 เครื่อง" },
        { status: 400 }
      );
    }

    // `key` ends up embedded in field names on the "ตัวชี้วัด" sheet
    // (e.g. "<key>_success") so it's restricted to safe characters — this
    // both prevents malformed/clashing field names and closes off anything
    // resembling formula/row injection via the admin form.
    const seen = new Set<string>();
    const cleaned: { key: string; label: string; active: boolean }[] = [];
    for (const m of machines) {
      const key = String(m?.key ?? "").trim();
      const label = String(m?.label ?? "").trim();
      if (!key || !/^[a-z0-9_]+$/i.test(key)) {
        return NextResponse.json(
          { error: `รหัสเครื่องไม่ถูกต้อง: "${m?.key ?? ""}" (ใช้ได้เฉพาะ a-z, 0-9, _ เท่านั้น)` },
          { status: 400 }
        );
      }
      if (!label) {
        return NextResponse.json({ error: `ต้องมีชื่อที่แสดงสำหรับเครื่อง "${key}"` }, { status: 400 });
      }
      if (seen.has(key.toLowerCase())) {
        return NextResponse.json({ error: `รหัสเครื่องซ้ำ: ${key}` }, { status: 400 });
      }
      seen.add(key.toLowerCase());
      cleaned.push({ key, label, active: Boolean(m?.active) });
    }

    await savePmMachines(cleaned);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
