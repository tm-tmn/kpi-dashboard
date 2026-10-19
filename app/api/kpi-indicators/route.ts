import { NextRequest, NextResponse } from "next/server";
import { readAllKpiIndicatorConfig, saveKpiIndicatorConfig } from "@/lib/sheets-kpi-indicators";
import { KPI_INDICATORS } from "@/lib/constants";

const BASE_IDS = new Set(KPI_INDICATORS.map((k) => k.id));
const VALID_KINDS = new Set(["direct_percent", "ratio_pair", "incident"]);

// Same pattern as /api/pm-machines, /api/service-points — live read on
// every GET, no prerendering/caching. Public like the other GETs; the POST
// (admin add/deactivate) is gated behind the login session in proxy.ts.

export async function GET() {
  try {
    const config = await readAllKpiIndicatorConfig();
    return NextResponse.json({ config });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rows } = body as { rows?: unknown[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "ต้องมีรายการตัวชี้วัดอย่างน้อย 1 รายการ" }, { status: 400 });
    }

    const seen = new Set<string>();
    const cleaned: Parameters<typeof saveKpiIndicatorConfig>[0] = [];

    for (const raw of rows) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      // `id` ends up embedded in field keys for custom indicators (e.g.
      // "<id>_pct"), so it's restricted the same way PM machines' `key` is —
      // both prevents malformed/clashing field names and closes off anything
      // resembling formula/row injection via the admin form.
      if (!id || !/^[a-z0-9_]+$/i.test(id)) {
        return NextResponse.json({ error: `รหัสตัวชี้วัดไม่ถูกต้อง: "${id}" (ใช้ได้เฉพาะ a-z, 0-9, _ เท่านั้น)` }, { status: 400 });
      }
      if (seen.has(id.toLowerCase())) {
        return NextResponse.json({ error: `รหัสตัวชี้วัดซ้ำ: ${id}` }, { status: 400 });
      }
      seen.add(id.toLowerCase());

      const active = Boolean(r.active);
      const order = Number.isFinite(Number(r.order)) ? Number(r.order) : 0;

      if (BASE_IDS.has(id)) {
        // An override row for one of the 6 original indicators — only
        // active/order are stored; its name/criteria/fields/target stay
        // the hardcoded ones in lib/constants.ts.
        cleaned.push({
          id, name: "", shortName: "", criteria: "", kind: "",
          field1Label: "", field2Label: "", targetValue: null, targetDirection: "", decimals: null,
          order, active,
        });
        continue;
      }

      // A custom indicator — full definition required.
      const name = String(r.name ?? "").trim();
      const criteria = String(r.criteria ?? "").trim();
      const kind = String(r.kind ?? "");
      const field1Label = String(r.field1Label ?? "").trim();
      const field2Label = String(r.field2Label ?? "").trim();

      if (!name) return NextResponse.json({ error: `ต้องมีชื่อตัวชี้วัดสำหรับ "${id}"` }, { status: 400 });
      if (!criteria) return NextResponse.json({ error: `ต้องมีเกณฑ์ประเมินสำหรับ "${name}"` }, { status: 400 });
      if (!VALID_KINDS.has(kind)) {
        return NextResponse.json({ error: `รูปแบบการกรอกข้อมูลไม่ถูกต้องสำหรับ "${name}"` }, { status: 400 });
      }
      if (!field1Label) {
        return NextResponse.json({ error: `ต้องมีชื่อช่องกรอกข้อมูลสำหรับ "${name}"` }, { status: 400 });
      }
      if ((kind === "ratio_pair" || kind === "incident") && !field2Label) {
        return NextResponse.json({ error: `ต้องมีชื่อช่องกรอกข้อมูลช่องที่ 2 สำหรับ "${name}"` }, { status: 400 });
      }

      let targetValue: number | null = null;
      let targetDirection: "max" | "min" | "" = "";
      if (r.targetValue != null && r.targetValue !== "") {
        const v = Number(r.targetValue);
        if (!Number.isFinite(v) || v < 0 || v > 100) {
          return NextResponse.json({ error: `ค่าเป้าหมายต้องเป็นตัวเลข 0-100 สำหรับ "${name}"` }, { status: 400 });
        }
        targetValue = v;
        targetDirection = r.targetDirection === "min" ? "min" : "max";
      }

      let decimals: number | null = null;
      if (r.decimals != null && r.decimals !== "") {
        const d = Number(r.decimals);
        if (!Number.isFinite(d) || d < 0 || d > 4) {
          return NextResponse.json({ error: `จำนวนทศนิยมไม่ถูกต้องสำหรับ "${name}"` }, { status: 400 });
        }
        decimals = d;
      }

      cleaned.push({
        id,
        name,
        shortName: String(r.shortName ?? "").trim(),
        criteria,
        kind: kind as "direct_percent" | "ratio_pair" | "incident",
        field1Label,
        field2Label,
        targetValue,
        targetDirection,
        decimals,
        order,
        active,
      });
    }

    await saveKpiIndicatorConfig(cleaned);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
