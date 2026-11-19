import type { Jingle } from "./types";

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i;
const DURATION_HINT_RE = /[_-](\d{1,3})s\./i;

/**
 * Extrahiert die Google-Drive-Datei-ID aus gängigen Share-Links:
 *  - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *  - https://drive.google.com/open?id=<ID>
 *  - https://drive.google.com/uc?export=download&id=<ID>
 */
export function extractDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  const byPath = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (byPath) return byPath[1];
  const byQuery = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (byQuery) return byQuery[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function extractDriveFolderId(input: string): string | null {
  const trimmed = input.trim();
  const byPath = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (byPath) return byPath[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export function driveProxyUrl(fileId: string): string {
  return `/api/audio/drive?id=${encodeURIComponent(fileId)}`;
}

/**
 * Liest alle Audiodateien aus einem öffentlichen Google-Drive-Ordner
 * über die schlanke embeddedfolderview-Seite aus.
 * Optionaler Dauer-Hinweis im Dateinamen (z. B. `stau_12s.mp3`), sonst 8 s.
 */
export async function fetchDriveFolderJingles(folderUrlOrId: string): Promise<Jingle[]> {
  const folderId = extractDriveFolderId(folderUrlOrId);
  if (!folderId) {
    throw new Error("Ungültige Google-Drive-Ordner-URL.");
  }

  const res = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`,
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Google Drive Ordner HTTP ${res.status}`);
  }

  const html = await res.text();
  const jingles: Jingle[] = [];
  const entryRe =
    /id="entry-([a-zA-Z0-9_-]{10,})"[\s\S]*?class="flip-entry-title"[^>]*>([^<]+)</g;
  let match: RegExpExecArray | null;

  while ((match = entryRe.exec(html)) !== null) {
    const fileId = match[1];
    const filename = match[2].trim();
    if (!AUDIO_EXT_RE.test(filename)) continue;

    const hintMatch = filename.match(DURATION_HINT_RE);
    const durationSec = hintMatch ? Number.parseInt(hintMatch[1], 10) : 8;
    const durationMs = Math.max(2000, Math.min(120_000, durationSec * 1000));

    jingles.push({
      id: `drive-folder-${fileId}`,
      title: filename.replace(AUDIO_EXT_RE, ""),
      source: "drive",
      url: driveProxyUrl(fileId),
      durationMs,
    });
  }

  return jingles;
}
