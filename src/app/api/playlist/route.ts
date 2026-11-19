import { NextRequest, NextResponse } from "next/server";
import { DEMO_TRACKS, loadStationState } from "@/lib/station";
import { fetchSunoPlaylist } from "@/lib/suno";

export const dynamic = "force-dynamic";

/**
 * PoC-Endpunkt: Parst eine öffentliche Suno-Playlist-URL.
 * Aufruf:
 *   GET /api/playlist?url=https://suno.com/playlist/<uuid>
 *   GET /api/playlist?demo=1
 *   GET /api/playlist   (nutzt konfigurierte URL aus station.json / Env)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const demo = searchParams.get("demo") === "1";

  if (demo) {
    return NextResponse.json({
      source: "demo",
      playlistId: "demo",
      trackCount: DEMO_TRACKS.length,
      tracks: DEMO_TRACKS,
      warnings: ["Demo-Modus aktiv – Platzhalter-Tracks werden ausgeliefert."],
      fetchedAt: Date.now(),
    });
  }

  let targetUrl = searchParams.get("url")?.trim() || null;
  if (!targetUrl) {
    const state = await loadStationState();
    targetUrl = state.playlistUrl;
  }

  if (!targetUrl) {
    return NextResponse.json(
      {
        error: "Keine Suno-Playlist-URL konfiguriert.",
        hint: "Übergebe ?url=https://suno.com/playlist/... oder ?demo=1 zum Testen.",
        tracks: DEMO_TRACKS,
        source: "demo-fallback",
      },
      { status: 200 },
    );
  }

  try {
    const result = await fetchSunoPlaylist(targetUrl);
    return NextResponse.json({
      source: result.source,
      playlistId: result.playlistId,
      trackCount: result.tracks.length,
      tracks: result.tracks,
      warnings: result.warnings,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Fehler beim Auslesen der Suno-Playlist",
        playlistUrl: targetUrl,
      },
      { status: 502 },
    );
  }
}
