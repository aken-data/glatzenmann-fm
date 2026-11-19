/** Ein Song aus der Suno-Playlist. Alle Zeitangaben in Millisekunden. */
export interface Track {
  id: string;
  title: string;
  audioUrl: string;
  coverUrl: string | null;
  durationMs: number;
}

/** Eine Station-ID („Glatzenmann FM“), 5–9 s, oder ein Einspieler (Nachrichten/Spaß). */
export interface Jingle {
  id: string;
  title?: string;
  source?: "suno" | "drive" | "blob" | "url" | "placeholder";
  url: string;
  durationMs: number;
}

/**
 * Eine „Ära“ ist ein eingefrorener Stand von Songs + Jingles, der ab `startsAt`
 * gilt. Änderungen an der Playlist erzeugen eine neue Ära, die erst an der
 * nächsten Durchlauf-Grenze beginnt – so springt niemandem der Plan weg.
 */
export interface Era {
  startsAt: number; // Unix-ms, exakt an einer Durchlauf-Grenze
  firstCycle: number; // globale Durchlauf-Nummer, mit der diese Ära beginnt
  songs: Track[];
  jingles: Jingle[];
}

/** Persistenter Zustand des Senders (liegt als station.json in Vercel Blob). */
export interface StationState {
  version: 1;
  seed: string;
  playlistUrl: string | null;
  jinglePlaylistUrl?: string | null;
  driveFolderUrl?: string | null;
  eras: Era[]; // aufsteigend nach startsAt
  lastRefresh: { at: number; ok: boolean; message: string; trackCount: number } | null;
}

export type ItemKind = "song" | "jingle";

/** Ein Eintrag im berechneten Sendeplan. */
export interface ScheduleItem {
  kind: ItemKind;
  cycle: number;
  index: number; // Position innerhalb des Durchlaufs (Songs + Jingles)
  startsAt: number; // Unix-ms
  durationMs: number;
  fadeInMs: number;
  fadeOutMs: number;
  track?: Track;
  jingle?: Jingle;
}

export interface NowPlaying {
  item: ScheduleItem;
  offsetMs: number; // wie weit der Titel schon läuft
  upcoming: ScheduleItem[];
}
