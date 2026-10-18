import { NextRequest, NextResponse } from "next/server";
import { readAllRecords } from "@/lib/sheets";
import { availableFiscalYears } from "@/lib/aggregate";
import { buildAttendanceWorkbook } from "@/lib/attendance-export";

// Read-only, same privacy level as GET /api/records (public dashboard data) —
// not covered by the write-auth gate in proxy.ts.
export async function GET(req: NextRequest) {
  try {
    const records = await readAllRecords();

    const years = availableFiscalYears(records);
    const yearParam = req.nextUrl.searchParams.get("year");
    const fiscalYear = yearParam ? Number(yearParam) : years[years.length - 1];

    if (!fiscalYear || !years.includes(fiscalYear)) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้รับบริการสำหรับปีงบประมาณนี้" }, { status: 404 });
    }

    const workbook = await buildAttendanceWorkbook(records, fiscalYear);
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
