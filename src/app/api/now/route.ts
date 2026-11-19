import { NextResponse } from "next/server";
import { nowPlaying } from "@/lib/schedule";
import { loadStationState } from "@/lib/station";

export const dynamic = "force-dynamic";

export async function GET() {
  const serverTime = Date.now();
  const state = await loadStationState();
  const current = nowPlaying(state, serverTime, 5);

  return NextResponse.json(
    {
      serverTime,
      state,
      current,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
