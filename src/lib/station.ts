import { list, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import { nowPlaying, planEra } from "./schedule";
import type { Jingle, NowPlaying, StationState, Track } from "./types";

const BLOB_PATH = "station.json";
const LOCAL_DIR = path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "station.json");

export const DEFAULT_PLACEHOLDER_JINGLES: Jingle[] = [
  {
    id: "placeholder-jingle-1",
    title: "Glatzenmann FM – Fanfare I (Platzhalter)",
    source: "placeholder",
    url: "/api/audio/placeholder?kind=jingle&variant=1",
    durationMs: 6000,
  },
  {
    id: "placeholder-jingle-2",
    title: "Glatzenmann FM – Fanfare II (Platzhalter)",
    source: "placeholder",
    url: "/api/audio/placeholder?kind=jingle&variant=2",
    durationMs: 7000,
  },
];

export const DEMO_TRACKS: Track[] = [
  {
    id: "demo-1",
    title: "Des Barden erster Schwank (Demo)",
    audioUrl: "/api/audio/placeholder?kind=song&variant=1",
    coverUrl: null,
    durationMs: 24000,
  },
  {
    id: "demo-2",
    title: "Tavernen-Polka zu Mitternacht (Demo)",
    audioUrl: "/api/audio/placeholder?kind=song&variant=2",
    coverUrl: null,
    durationMs: 26000,
  },
  {
    id: "demo-3",
    title: "Glatzenmanns Kreuzzug (Demo)",
    audioUrl: "/api/audio/placeholder?kind=song&variant=3",
    coverUrl: null,
    durationMs: 22000,
  },
  {
    id: "demo-4",
    title: "Met & Lautenklang (Demo)",
    audioUrl: "/api/audio/placeholder?kind=song&variant=4",
    coverUrl: null,
    durationMs: 25000,
  },
  {
    id: "demo-5",
    title: "Ritter ohne Haupthaar (Demo)",
    audioUrl: "/api/audio/placeholder?kind=song&variant=5",
    coverUrl: null,
    durationMs: 23000,
  },
];

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function createInitialState(): StationState {
  const playlistUrl = process.env.SUNO_PLAYLIST_URL?.trim() || null;
  const jinglePlaylistUrl = process.env.JINGLE_PLAYLIST_URL?.trim() || null;
  const driveFolderUrl = process.env.DRIVE_JINGLES_FOLDER_URL?.trim() || null;
  const seed = process.env.STATION_SEED?.trim() || "glatzenmann-fm-2026";
  const base: StationState = {
    version: 1,
    seed,
    playlistUrl,
    jinglePlaylistUrl,
    driveFolderUrl,
    eras: [],
    lastRefresh: null,
  };
  // Solange noch keine Suno-Playlist geladen wurde, starten wir mit Demo-Tracks + Platzhalter-Jingles,
  // damit Player und Sendeplan sofort testbar sind.
  const planned = planEra(base, DEMO_TRACKS, DEFAULT_PLACEHOLDER_JINGLES, Date.now());
  return planned ?? base;
}

export async function loadStationState(): Promise<StationState> {
  if (hasBlobToken()) {
    try {
      const { blobs } = await list({ prefix: BLOB_PATH, limit: 5 });
      const exact = blobs.find((b) => b.pathname === BLOB_PATH);
      if (exact) {
        const sep = exact.url.includes("?") ? "&" : "?";
        const res = await fetch(`${exact.url}${sep}t=${Date.now()}`, { cache: "no-store" });
        if (res.ok) {
          const parsed = (await res.json()) as StationState;
          if (parsed && parsed.version === 1) return parsed;
        }
      }
    } catch (err) {
      console.error("[station] Failed to read from Vercel Blob:", err);
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    const parsed = JSON.parse(raw) as StationState;
    if (parsed && parsed.version === 1) return parsed;
  } catch {
    // Noch keine lokale Datei vorhanden
  }

  const initial = createInitialState();
  await saveStationState(initial);
  return initial;
}

export async function saveStationState(state: StationState): Promise<void> {
  const body = JSON.stringify(state, null, 2);

  if (hasBlobToken()) {
    await put(BLOB_PATH, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return;
  }

  try {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(LOCAL_FILE, body, "utf8");
  } catch (err) {
    // Auf schreibgeschützten Dateisystemen ohne Blob-Token nur loggen
    console.warn("[station] Could not persist station.json locally:", err);
  }
}

export async function getNowSnapshot(): Promise<{
  serverTime: number;
  state: StationState;
  current: NowPlaying | null;
}> {
  const serverTime = Date.now();
  const state = await loadStationState();
  const current = nowPlaying(state, serverTime, 5);
  return { serverTime, state, current };
}
