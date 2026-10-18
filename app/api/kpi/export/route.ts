import { NextRequest, NextResponse } from "next/server";
import { readAllKpiRecords } from "@/lib/sheets-kpi";
import { readAllRecords } from "@/lib/sheets";
import { availableKpiYears } from "@/lib/aggregate-kpi";
import { buildKpiWorkbook } from "@/lib/kpi-export";

// Read-only, same privacy level as GET /api/kpi (public dashboard data) —
// not covered by the write-auth gate in proxy.ts.
export async function GET(req: NextRequest) {
  try {
    const [kpiRecords, attendance] = await Promise.all([readAllKpiRecords(), readAllRecords()]);

    const years = availableKpiYears(kpiRecords);
    const yearParam = req.nextUrl.searchParams.get("year");
    const fiscalYear = yearParam ? Number(yearParam) : years[years.length - 1];

    if (!fiscalYear || !years.includes(fiscalYear)) {
      return NextResponse.json({ error: "ไม่พบข้อมูลตัวชี้วัดคุณภาพสำหรับปีงบประมาณนี้" }, { status: 404 });
    }

    const workbook = await buildKpiWorkbook(kpiRecords, attendance, fiscalYear);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="KPI_summary_${fiscalYear}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
