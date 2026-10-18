import { NextRequest, NextResponse } from "next/server";
import { readAllTatRecords } from "@/lib/sheets-tat";
import { availableTatYears } from "@/lib/aggregate-tat";
import { buildTatWorkbook } from "@/lib/tat-export";

// Read-only, same privacy level as GET /api/tat (public dashboard data) —
// not covered by the write-auth gate in proxy.ts.
export async function GET(req: NextRequest) {
  try {
    const records = await readAllTatRecords();

    const years = availableTatYears(records);
    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : years[years.length - 1];

    if (!year || !years.includes(year)) {
      return NextResponse.json({ error: "ไม่พบข้อมูล TAT สำหรับปีนี้" }, { status: 404 });
    }

    const workbook = await buildTatWorkbook(records, year);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="TAT_${year}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
