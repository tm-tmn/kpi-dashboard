import { NextResponse } from "next/server";
import { SESSION_COOKIE, expectedSessionToken, makeSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = await expectedSessionToken();
  if (!expected) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า ENTRY_PASSWORD บนเซิร์ฟเวอร์" },
      { status: 500 }
    );
  }

  let password: string;
  try {
    const body = await req.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "กรุณากรอกรหัสผ่าน" }, { status: 400 });
  }

  const token = await makeSessionToken(password);
  if (token !== expected) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
