import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("bar_session", "", { path: "/", maxAge: 0, sameSite: "lax" });
  response.cookies.set("bar_role", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}
