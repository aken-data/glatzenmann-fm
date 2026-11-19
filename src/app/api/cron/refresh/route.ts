import { NextRequest, NextResponse } from "next/server";
import { refreshStationPlaylist } from "@/lib/refresh";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const res = await refreshStationPlaylist();
  return NextResponse.json({
    ok: res.state.lastRefresh?.ok ?? false,
    changed: res.changed,
    trackCount: res.trackCount,
    message: res.message,
  });
}
