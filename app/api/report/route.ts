import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { readAllRecords } from "@/lib/sheets";
import { readAllTatRecords } from "@/lib/sheets-tat";
import { readAllKpiRecords } from "@/lib/sheets-kpi";
import { readAllPmMachines } from "@/lib/sheets-pm-machines";
import { readAllKpiIndicatorConfig } from "@/lib/sheets-kpi-indicators";
import { readAllServicePoints } from "@/lib/sheets-service-points";
import { SERVICE_POINTS, TAT_STAGES, withPmGroups, withKpiIndicatorConfig } from "@/lib/constants";
import { buildReportData, type ReportRequest } from "@/lib/report-data";
import { ReportDocument } from "@/lib/report-pdf";

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// POST because it carries free-text + signer names; gated behind the admin
// session in proxy.ts like every other write route.
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Record<string, unknown>;
    const type = b.type;
    const year = Number(b.year);
    const month = Number(b.month);
    if (type !== "month" && type !== "fiscal" && type !== "calendar") {
      return NextResponse.json({ error: "ประเภทรายงานไม่ถูกต้อง" }, { status: 400 });
    }
    if (!Number.isInteger(year) || year < 2500 || year > 2700) {
      return NextResponse.json({ error: "ปีไม่ถูกต้อง" }, { status: 400 });
    }
    if (type === "month" && !(Number.isInteger(month) && month >= 1 && month <= 12)) {
      return NextResponse.json({ error: "เดือนไม่ถูกต้อง" }, { status: 400 });
    }
    const person = (v: unknown) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return { name: clip(o.name, 100), position: clip(o.position, 100) };
    };
    const request: ReportRequest = {
      type,
      year,
      month: type === "month" ? month : undefined,
      observations: clip(b.observations, 3000),
      preparer: person(b.preparer),
      approver: person(b.approver),
    };

    const [attendance, tat, kpiRecords, pmMachines, kpiConfig, pointRows] = await Promise.all([
      readAllRecords(),
      readAllTatRecords(),
      readAllKpiRecords(),
      readAllPmMachines(),
      readAllKpiIndicatorConfig(),
      readAllServicePoints(),
    ]);

    const activePoints = pointRows.filter((p) => p.active).map((p) => p.point);
    const baseIndicators = withPmGroups(pmMachines.filter((m) => m.active).map((m) => ({ key: m.key, label: m.label })));
    const data = buildReportData({
      req: request,
      attendance,
      tat,
      kpiRecords,
      indicators: withKpiIndicatorConfig(baseIndicators, kpiConfig),
      points: activePoints.length ? activePoints : [...SERVICE_POINTS],
      stages: [...TAT_STAGES],
    });

    const buffer = await renderToBuffer(ReportDocument({ d: data }) as React.ReactElement<DocumentProps>);
    const name = type === "month" ? `report_${year}-${String(month).padStart(2, "0")}` : `report_${type === "fiscal" ? "FY" : "CY"}${year}`;
    const thai = type === "month" ? `รายงานประจำเดือน_${year}-${String(month).padStart(2, "0")}` : `รายงานประจำปี${type === "fiscal" ? "งบประมาณ" : "ปฏิทิน"}_${year}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        // Latin-1-only header values: ASCII fallback + RFC 5987 UTF-8 name.
        "Content-Disposition": `attachment; filename="${name}.pdf"; filename*=UTF-8''${encodeURIComponent(`${thai}.pdf`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
