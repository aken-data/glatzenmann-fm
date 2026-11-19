import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  checkPassword,
  createSessionToken,
  getAdminPassword,
  getListenerPassword,
  LISTENER_COOKIE,
  type AuthRole,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { password?: string; role?: AuthRole } = {};
  try {
    body = (await request.json()) as { password?: string; role?: AuthRole };
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const role: AuthRole = body.role === "admin" ? "admin" : "listener";
  const expected = role === "admin" ? getAdminPassword() : getListenerPassword();

  if (!checkPassword(password, expected)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          role === "admin"
            ? "Falscher Vogt-Schlüssel!"
            : "Falsch geraten, Wanderer! Dieses Losungswort öffnet das Tor nicht.",
      },
      { status: 401 },
    );
  }

  const token = await createSessionToken(role);
  const cookieName = role === "admin" ? ADMIN_COOKIE : LISTENER_COOKIE;
  const response = NextResponse.json({ ok: true, role });

  response.cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") === "admin" ? "admin" : "listener";
  const cookieName = role === "admin" ? ADMIN_COOKIE : LISTENER_COOKIE;
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
