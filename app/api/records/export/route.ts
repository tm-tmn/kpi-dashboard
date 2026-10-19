import { NextRequest, NextResponse } from "next/server";
import { readAllRecords } from "@/lib/sheets";
import { availableFiscalYears } from "@/lib/aggregate";
import { buildAttendanceWorkbook } from "@/lib/attendance-export";
import { readAllServicePoints, readAllPatientTypes } from "@/lib/sheets-service-points";

// Read-only, same privacy level as GET /api/records (public dashboard data) —
// not covered by the write-auth gate in proxy.ts.
export async function GET(req: NextRequest) {
  try {
    const [records, pointRows, typeRows] = await Promise.all([
      readAllRecords(),
      readAllServicePoints(),
      readAllPatientTypes(),
    ]);

    const years = availableFiscalYears(records);
    const yearParam = req.nextUrl.searchParams.get("year");
    const fiscalYear = yearParam ? Number(yearParam) : years[years.length - 1];

    if (!fiscalYear || !years.includes(fiscalYear)) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้รับบริการสำหรับปีงบประมาณนี้" }, { status: 404 });
    }

    const points = pointRows.filter((p) => p.active).map((p) => p.point);
    const pairs = typeRows.filter((t) => t.active).map((t) => ({ point: t.point, type: t.type }));
    const workbook = await buildAttendanceWorkbook(
      records,
      fiscalYear,
      points.length ? points : undefined,
      pairs.length ? pairs : undefined
    );
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="จำนวนผู้รับบริการ_${fiscalYear}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
