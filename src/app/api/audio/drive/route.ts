import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxyt öffentliche Google-Drive-Audiodateien (inkl. Range-Header für Seeking),
 * damit <audio> keine CORS- oder Redirect-Probleme mit drive.google.com bekommt.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) {
    return NextResponse.json({ error: "Ungültige Google-Drive-ID" }, { status: 400 });
  }

  const target = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0",
  };
  const range = request.headers.get("range");
  if (range) headers.Range = range;

  const upstream = await fetch(target, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      {
        error: `Google Drive antwortete mit HTTP ${upstream.status}. Ist die Datei auf „Jeder mit dem Link“ freigegeben?`,
      },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") || "audio/mpeg";
  if (contentType.includes("text/html")) {
    return NextResponse.json(
      {
        error:
          "Google Drive lieferte eine HTML-Seite statt Audio. Prüfe die Freigabe („Jeder mit dem Link“).",
      },
      { status: 502 },
    );
  }

  const outHeaders = new Headers();
  outHeaders.set("Content-Type", contentType.startsWith("audio/") ? contentType : "audio/mpeg");
  outHeaders.set("Accept-Ranges", "bytes");
  outHeaders.set("Cache-Control", "public, max-age=3600");

  for (const h of ["content-length", "content-range"]) {
    const val = upstream.headers.get(h);
    if (val) outHeaders.set(h, val);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
