import { fetchDriveFolderJingles } from "./drive";
import { planEra } from "./schedule";
import { DEFAULT_PLACEHOLDER_JINGLES, loadStationState, saveStationState } from "./station";
import { fetchSunoPlaylist } from "./suno";
import type { Jingle, StationState } from "./types";

export async function refreshStationPlaylist(
  overrideSongUrl?: string | null,
  overrideJingleUrl?: string | null,
  overrideDriveFolderUrl?: string | null,
): Promise<{
  state: StationState;
  changed: boolean;
  trackCount: number;
  jingleCount: number;
  message: string;
}> {
  const state = await loadStationState();
  const targetUrl =
    (overrideSongUrl !== undefined ? overrideSongUrl : state.playlistUrl)?.trim() || null;
  const targetJingleUrl =
    (overrideJingleUrl !== undefined ? overrideJingleUrl : state.jinglePlaylistUrl)?.trim() || null;
  const targetDriveFolderUrl =
    (overrideDriveFolderUrl !== undefined ? overrideDriveFolderUrl : state.driveFolderUrl)?.trim() ||
    null;

  if (!targetUrl) {
    return {
      state,
      changed: false,
      trackCount: 0,
      jingleCount: 0,
      message: "Keine Suno-Playlist-URL hinterlegt.",
    };
  }

  const now = Date.now();
  try {
    const result = await fetchSunoPlaylist(targetUrl);
    if (result.tracks.length === 0) {
      const updated: StationState = {
        ...state,
        playlistUrl: targetUrl,
        jinglePlaylistUrl: targetJingleUrl,
        driveFolderUrl: targetDriveFolderUrl,
        lastRefresh: {
          at: now,
          ok: false,
          message: result.warnings[0] || "Playlist enthielt 0 abspielbare Songs.",
          trackCount: 0,
        },
      };
      await saveStationState(updated);
      return {
        state: updated,
        changed: false,
        trackCount: 0,
        jingleCount: 0,
        message: updated.lastRefresh!.message,
      };
    }

    // Manuell eingetragene Jingles behalten; Suno-Jingles & Drive-Ordner frisch laden
    const existingJingles = state.eras[state.eras.length - 1]?.jingles ?? [];
    const manualJingles = existingJingles.filter(
      (j) =>
        j.source &&
        j.source !== "suno" &&
        j.source !== "placeholder" &&
        !j.id.startsWith("drive-folder-"),
    );

    let sunoJingles: Jingle[] = [];
    const notes: string[] = [];
    if (targetJingleUrl) {
      try {
        const jRes = await fetchSunoPlaylist(targetJingleUrl);
        sunoJingles = jRes.tracks.map((t) => ({
          id: `suno-jingle-${t.id}`,
          title: t.title,
          source: "suno",
          url: t.audioUrl,
          durationMs: t.durationMs,
        }));
        notes.push(`${sunoJingles.length} Suno-Jingles`);
      } catch (jErr) {
        notes.push(
          `Suno-Jingles Fehler: ${jErr instanceof Error ? jErr.message : String(jErr)}`,
        );
      }
    }

    let driveFolderJingles: Jingle[] = [];
    if (targetDriveFolderUrl) {
      try {
        driveFolderJingles = await fetchDriveFolderJingles(targetDriveFolderUrl);
        notes.push(`${driveFolderJingles.length} Drive-Ordner-Dateien`);
      } catch (dErr) {
        notes.push(
          `Drive-Ordner Fehler: ${dErr instanceof Error ? dErr.message : String(dErr)}`,
        );
      }
    }

    const combinedJingles = [...manualJingles, ...sunoJingles, ...driveFolderJingles];
    const finalJingles =
      combinedJingles.length > 0 ? combinedJingles : DEFAULT_PLACEHOLDER_JINGLES;

    const needsImmediateReplace =
      state.eras.length > 0 &&
      (state.eras.every((e) => e.songs.every((s) => s.id.startsWith("demo-"))) ||
        state.eras.some((e) => e.songs.some((s) => s.audioUrl.endsWith(".m4a"))));

    const noteStr = notes.length > 0 ? ` + ${notes.join(", ")}` : "";
    const nextStateBase: StationState = {
      ...state,
      playlistUrl: targetUrl,
      jinglePlaylistUrl: targetJingleUrl,
      driveFolderUrl: targetDriveFolderUrl,
      eras: needsImmediateReplace ? [] : state.eras,
      lastRefresh: {
        at: now,
        ok: true,
        message: `Erfolgreich via ${result.source} geladen (${result.tracks.length} Songs${noteStr}).`,
        trackCount: result.tracks.length,
      },
    };

    const planned = planEra(nextStateBase, result.tracks, finalJingles, now);
    const finalState = planned ?? nextStateBase;
    await saveStationState(finalState);

    return {
      state: finalState,
      changed: Boolean(planned),
      trackCount: result.tracks.length,
      jingleCount: finalJingles.length,
      message: finalState.lastRefresh!.message,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler beim Laden";
    const updated: StationState = {
      ...state,
      playlistUrl: targetUrl,
      jinglePlaylistUrl: targetJingleUrl,
      driveFolderUrl: targetDriveFolderUrl,
      lastRefresh: { at: now, ok: false, message: msg, trackCount: 0 },
    };
    await saveStationState(updated);
    return { state: updated, changed: false, trackCount: 0, jingleCount: 0, message: msg };
  }
}
