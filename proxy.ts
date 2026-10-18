import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, expectedSessionToken } from "@/lib/auth";

// Gate the data-entry page and the write endpoint behind the single-user
// password session. The public dashboard and GET /api/records stay open.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isWriteApi =
    (pathname.startsWith("/api/records") ||
      pathname.startsWith("/api/tat") ||
      pathname.startsWith("/api/kpi")) &&
    req.method === "POST";

  const needsAuth = pathname.startsWith("/entry") || isWriteApi;

  if (!needsAuth) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await expectedSessionToken();
  const authed = Boolean(cookie && expected && cookie === expected);

  if (authed) {
    return NextResponse.next();
  }

  if (isWriteApi) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบก่อนบันทึกข้อมูล" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/entry", "/entry/:path*", "/api/records", "/api/tat", "/api/kpi"],
};
