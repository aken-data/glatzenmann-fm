import { NextRequest, NextResponse } from "next/server";
import { LISTENER_COOKIE, verifySessionToken } from "./lib/auth";

const PUBLIC_PATHS = ["/einlass", "/api/auth", "/api/cron/refresh", "/api/playlist"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/admin") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(LISTENER_COOKIE)?.value;
  const valid = await verifySessionToken(token, "listener");

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Einlass verwehrt" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/einlass";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
