import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { refreshStationPlaylist } from "@/lib/refresh";
import { loadStationState, saveStationState } from "@/lib/station";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, "admin");
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  const state = await loadStationState();
  return NextResponse.json({ state, serverTime: Date.now() });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: {
    action?: string;
    playlistUrl?: string;
    jinglePlaylistUrl?: string;
    driveFolderUrl?: string;
    seed?: string;
  } = {};
  try {
    body = (await request.json()) as {
      action?: string;
      playlistUrl?: string;
      jinglePlaylistUrl?: string;
      driveFolderUrl?: string;
      seed?: string;
    };
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  if (body.action === "refresh") {
    const res = await refreshStationPlaylist(
      body.playlistUrl,
      body.jinglePlaylistUrl,
      body.driveFolderUrl,
    );
    return NextResponse.json(res);
  }

  if (body.action === "config") {
    const state = await loadStationState();
    const updated = {
      ...state,
      playlistUrl: body.playlistUrl !== undefined ? body.playlistUrl.trim() || null : state.playlistUrl,
      jinglePlaylistUrl:
        body.jinglePlaylistUrl !== undefined
          ? body.jinglePlaylistUrl.trim() || null
          : state.jinglePlaylistUrl,
      driveFolderUrl:
        body.driveFolderUrl !== undefined
          ? body.driveFolderUrl.trim() || null
          : state.driveFolderUrl,
      seed: body.seed?.trim() || state.seed,
    };
    await saveStationState(updated);
    return NextResponse.json({ state: updated, message: "Konfiguration gespeichert." });
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}
