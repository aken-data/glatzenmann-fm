import type { Track } from "./types";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
};

export interface SunoParseResult {
  playlistId: string;
  source: "studio-api" | "html-rsc";
  tracks: Track[];
  warnings: string[];
}

export function extractPlaylistId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

interface RawMediaUrl {
  url?: unknown;
  content_type?: unknown;
  delivery?: unknown;
}

interface RawSunoClip {
  id?: unknown;
  title?: unknown;
  audio_url?: unknown;
  video_url?: unknown;
  media_urls?: unknown;
  image_url?: unknown;
  image_large_url?: unknown;
  metadata?: {
    duration?: unknown;
  } | null;
  duration?: unknown;
}

function pickAudioUrl(raw: RawSunoClip): string {
  // 1. Direkte MP3-URL, falls nicht /api/forbidden
  const direct = typeof raw.audio_url === "string" ? raw.audio_url.trim() : "";
  if (direct && !direct.includes("/api/forbidden")) return direct;

  // 2. video_url (.mp4 mit AAC-Audio) – funktioniert in jedem Browser (Chrome/Safari/Firefox),
  //    während Sunos m4a-opus in Chrome zu NotSupportedError führt.
  const video = typeof raw.video_url === "string" ? raw.video_url.trim() : "";
  if (video && !video.includes("/api/forbidden")) return video;

  // 3. Fallback: media_urls
  if (Array.isArray(raw.media_urls)) {
    const candidates = raw.media_urls.filter(
      (m): m is RawMediaUrl =>
        Boolean(m && typeof m === "object" && typeof (m as RawMediaUrl).url === "string"),
    );
    const nonOpus = candidates.find(
      (m) =>
        m.content_type !== "m4a-opus" && !(m.url as string).includes("/api/forbidden"),
    );
    if (nonOpus) return (nonOpus.url as string).trim();
    const anyValid = candidates.find((m) => !(m.url as string).includes("/api/forbidden"));
    if (anyValid) return (anyValid.url as string).trim();
  }
  return "";
}

function normalizeClip(raw: RawSunoClip): Track | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const audioUrl = pickAudioUrl(raw);
  if (!id || !audioUrl) return null;

  const rawDuration =
    typeof raw.metadata?.duration === "number"
      ? raw.metadata.duration
      : typeof raw.duration === "number"
        ? raw.duration
        : 0;

  if (!Number.isFinite(rawDuration) || rawDuration <= 0) return null;

  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title.trim()
      : `Suno Track ${id.slice(0, 8)}`;

  const coverUrl =
    typeof raw.image_large_url === "string" && raw.image_large_url.startsWith("http")
      ? raw.image_large_url
      : typeof raw.image_url === "string" && raw.image_url.startsWith("http")
        ? raw.image_url
        : null;

  return {
    id,
    title,
    audioUrl,
    coverUrl,
    durationMs: Math.round(rawDuration * 1000),
  };
}

function dedupeTracks(tracks: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of tracks) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * Versuch 1: Suno Studio-API (liefert JSON mit Cursor-Pagination).
 */
async function fetchViaStudioApi(playlistId: string): Promise<{ tracks: Track[]; warnings: string[] }> {
  const tracks: Track[] = [];
  const warnings: string[] = [];
  let forbiddenCount = 0;
  let cursor: string | null = null;

  for (let page = 0; page < 30; page++) {
    const endpoint = cursor
      ? `https://studio-api.prod.suno.com/api/playlist/${playlistId}/?cursor=${encodeURIComponent(cursor)}`
      : `https://studio-api.prod.suno.com/api/playlist/${playlistId}/`;
    const res = await fetch(endpoint, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      throw new Error(`Studio API HTTP ${res.status} (Seite ${page})`);
    }

    const data = (await res.json()) as {
      playlist_clips?: Array<{ clip?: RawSunoClip } | RawSunoClip>;
      next_cursor?: string | null;
      num_total_results?: number;
    };

    const items = Array.isArray(data.playlist_clips) ? data.playlist_clips : [];
    if (items.length === 0) break;

    for (const entry of items) {
      const clip = entry && typeof entry === "object" && "clip" in entry && entry.clip ? entry.clip : entry;
      const rawClip = clip as RawSunoClip;
      const track = normalizeClip(rawClip);
      if (track) {
        tracks.push(track);
      } else if (
        typeof rawClip?.audio_url === "string" &&
        rawClip.audio_url.includes("/api/forbidden")
      ) {
        forbiddenCount++;
      } else {
        warnings.push(`Übersprungener Clip auf Seite ${page} (fehlende Audio-URL oder Dauer)`);
      }
    }

    if (!data.next_cursor || data.next_cursor === cursor) break;
    cursor = data.next_cursor;
  }

  if (forbiddenCount > 0) {
    warnings.unshift(
      `${forbiddenCount} Song(s) in dieser Playlist sind auf Suno noch privat (/api/forbidden) und können ohne Login nicht abgespielt werden.`,
    );
  }

  return { tracks: dedupeTracks(tracks), warnings };
}

/**
 * Versuch 2: Öffentliche HTML-Seite parsen (Next.js RSC-Payload / eingebettetes JSON).
 */
function extractClipsFromHtml(html: string): RawSunoClip[] {
  const clips: RawSunoClip[] = [];
  // Unescape Next.js self.__next_f.push([...]) Strings
  const unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

  // Suche nach Objekten mit "audio_url":"https://..." in der Nähe von "id":"<uuid>"
  const audioRe = /"audio_url"\s*:\s*"(https?:\/\/[^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = audioRe.exec(unescaped)) !== null) {
    const start = Math.max(0, match.index - 1200);
    const end = Math.min(unescaped.length, match.index + 1500);
    const window = unescaped.slice(start, end);

    const idMatch = window.match(/"id"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i);
    const titleMatch = window.match(/"title"\s*:\s*"([^"]*)"/);
    const durMatch = window.match(/"duration"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
    const imgMatch = window.match(/"image_(?:large_)?url"\s*:\s*"(https?:\/\/[^"]+)"/);

    if (idMatch && durMatch) {
      clips.push({
        id: idMatch[1],
        title: titleMatch ? titleMatch[1] : undefined,
        audio_url: match[1],
        image_url: imgMatch ? imgMatch[1] : undefined,
        duration: Number.parseFloat(durMatch[1]),
      });
    }
  }
  return clips;
}

async function fetchViaHtml(playlistId: string): Promise<{ tracks: Track[]; warnings: string[] }> {
  const pageUrl = `https://suno.com/playlist/${playlistId}`;
  const res = await fetch(pageUrl, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`Suno HTML HTTP ${res.status}`);
  }
  const html = await res.text();
  const rawClips = extractClipsFromHtml(html);
  const tracks = dedupeTracks(rawClips.map(normalizeClip).filter((t): t is Track => t !== null));
  const warnings: string[] = [];
  if (tracks.length === 0) {
    warnings.push(
      "Keine abspielbaren Songs im HTML gefunden. Ist die Playlist wirklich öffentlich und sind die Songs darin auf 'Public' gestellt?",
    );
  }
  return { tracks, warnings };
}

export async function fetchSunoPlaylist(urlOrId: string): Promise<SunoParseResult> {
  const playlistId = extractPlaylistId(urlOrId);
  if (!playlistId) {
    throw new Error("Ungültige Suno-Playlist-URL (keine Playlist-UUID gefunden).");
  }

  const warnings: string[] = [];
  try {
    const apiRes = await fetchViaStudioApi(playlistId);
    if (apiRes.tracks.length > 0) {
      return {
        playlistId,
        source: "studio-api",
        tracks: apiRes.tracks,
        warnings: apiRes.warnings,
      };
    }
    warnings.push("Studio API lieferte 0 Tracks, weiche auf HTML-Parser aus.");
  } catch (err) {
    warnings.push(`Studio API fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  }

  const htmlRes = await fetchViaHtml(playlistId);
  return {
    playlistId,
    source: "html-rsc",
    tracks: htmlRes.tracks,
    warnings: [...warnings, ...htmlRes.warnings],
  };
}
