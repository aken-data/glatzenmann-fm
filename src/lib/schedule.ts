/**
 * Sendeplan-Engine für Glatzenmann.fm
 *
 * Alle Hörer berechnen aus (StationState + Serverzeit) denselben Plan:
 *  - Ein Durchlauf (cycle) = alle Songs der Ära genau einmal, seeded geshuffelt.
 *  - An Durchlauf-Grenzen gibt es keine direkten Wiederholungen (die ersten M
 *    Songs eines Durchlaufs kommen nicht unter den letzten M des vorherigen vor).
 *  - Nach jeweils 2–3 Songs (seeded) eine Station-ID. Die Gruppen summieren sich
 *    exakt zur Songanzahl, d. h. jeder Durchlauf endet mit einem Jingle.
 *  - Song→Song: Crossfade (Überlappung). Song→Jingle: Fade-to-Black, dann Jingle.
 *
 * Reine Funktionen, kein I/O, kein Math.random() – läuft auf Server und Client.
 */
import { rngFor, randInt, shuffle } from "./prng.ts";
import type { Era, Jingle, NowPlaying, ScheduleItem, StationState, Track } from "./types.ts";

export const CROSSFADE_MS = 4000;
export const JINGLE_CROSSFADE_MS = 2800;
export const JINGLE_OUT_OVERLAP_MS = 1500;
export const MAX_SEPARATION = 5;

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

function separationFor(n: number): number {
  return Math.min(MAX_SEPARATION, Math.floor(n / 3));
}

/** Rohe Reihenfolge eines Durchlaufs (nur Seed + Durchlauf-Nummer). */
export function rawOrder(seed: string, era: Era, cycle: number): Track[] {
  const sorted = era.songs.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return shuffle(sorted, rngFor(seed, "order", cycle));
}

/**
 * Finale Reihenfolge: rohe Reihenfolge + Grenz-Korrektur. Getauscht wird nur
 * in den Positionen [0, n-M), daher bleibt das Ende (Tail) gleich der rohen
 * Reihenfolge – der nächste Durchlauf hängt also nur vom *rohen* Vorgänger ab
 * und es entsteht keine Rekursionskette.
 */
export function finalOrder(seed: string, era: Era, cycle: number, prevTailIds: readonly string[]): Track[] {
  const order = rawOrder(seed, era, cycle);
  const n = order.length;
  const m = separationFor(n);
  if (m === 0 || prevTailIds.length === 0) return order;
  const tail = new Set(prevTailIds.slice(-m));
  const rng = rngFor(seed, "sep", cycle);
  const span = n - 2 * m; // Kandidaten-Bereich [m, n-m)
  for (let i = 0; i < m; i++) {
    if (!tail.has(order[i].id)) continue;
    const start = randInt(rng, Math.max(span, 1));
    for (let k = 0; k < span; k++) {
      const j = m + ((start + k) % span);
      if (!tail.has(order[j].id)) {
        [order[i], order[j]] = [order[j], order[i]];
        break;
      }
    }
  }
  return order;
}

/** Gruppengrößen (2 oder 3), die exakt n ergeben. */
export function jingleGroups(seed: string, cycle: number, n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const rng = rngFor(seed, "groups", cycle);
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    if (remaining === 2 || remaining === 3) {
      groups.push(remaining);
      break;
    }
    if (remaining === 4) {
      groups.push(2);
      remaining -= 2;
      continue;
    }
    const g = rng() < 0.5 ? 2 : 3;
    groups.push(g);
    remaining -= g;
  }
  return groups;
}

function pickJingles(seed: string, cycle: number, jingles: readonly Jingle[], count: number): Jingle[] {
  if (jingles.length === 0) return [];
  const sorted = jingles.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const rng = rngFor(seed, "jingles", cycle);
  const out: Jingle[] = [];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let idx = randInt(rng, sorted.length);
    if (sorted.length > 1 && idx === last) idx = (idx + 1 + randInt(rng, sorted.length - 1)) % sorted.length;
    out.push(sorted[idx]);
    last = idx;
  }
  return out;
}

function overlap(a: number, b: number): number {
  return Math.min(CROSSFADE_MS, Math.floor(a / 4), Math.floor(b / 4));
}

// ---------------------------------------------------------------------------
// Durchlauf bauen
// ---------------------------------------------------------------------------

export interface BuiltCycle {
  cycle: number;
  startsAt: number;
  endsAt: number;
  items: ScheduleItem[];
  rawTailIds: string[];
}

export function buildCycle(
  seed: string,
  era: Era,
  cycle: number,
  startsAt: number,
  prevTailIds: readonly string[],
): BuiltCycle {
  const order = finalOrder(seed, era, cycle, prevTailIds);
  const groups = era.jingles.length > 0 ? jingleGroups(seed, cycle, order.length) : [order.length];
  const jingles = pickJingles(seed, cycle, era.jingles, groups.length);

  // Sequenz aufbauen
  type Raw = { kind: "song"; track: Track } | { kind: "jingle"; jingle: Jingle };
  const seq: Raw[] = [];
  let p = 0;
  groups.forEach((g, gi) => {
    for (let k = 0; k < g; k++) seq.push({ kind: "song", track: order[p++] });
    if (jingles[gi]) seq.push({ kind: "jingle", jingle: jingles[gi] });
  });

  const items: ScheduleItem[] = [];
  let t = startsAt;
  for (let i = 0; i < seq.length; i++) {
    const cur = seq[i];
    const next = seq[i + 1];
    const prev = seq[i - 1];
    const durationMs = cur.kind === "song" ? cur.track.durationMs : cur.jingle.durationMs;

    let fadeInMs = 0;
    let fadeOutMs = 0;
    let advance = durationMs;

    if (cur.kind === "song") {
      if (prev?.kind === "song") {
        fadeInMs = overlap(prev.track.durationMs, durationMs);
      } else if (prev?.kind === "jingle") {
        fadeInMs = Math.min(
          JINGLE_OUT_OVERLAP_MS,
          Math.floor(prev.jingle.durationMs / 4),
          Math.floor(durationMs / 4),
        );
      }

      if (next?.kind === "song") {
        fadeOutMs = overlap(durationMs, next.track.durationMs);
        advance = durationMs - fadeOutMs; // nächster Song startet im Crossfade
      } else if (next?.kind === "jingle") {
        // Song -> Jingle: knackiger Radio-Crossfade, schneidet Suno-Endstille weg
        fadeOutMs = Math.min(
          JINGLE_CROSSFADE_MS,
          Math.floor(durationMs / 4),
          Math.floor(next.jingle.durationMs / 2),
        );
        advance = durationMs - fadeOutMs;
      } else {
        fadeOutMs = Math.min(JINGLE_CROSSFADE_MS, Math.floor(durationMs / 4));
      }
    } else {
      // Jingle -> nächster Song: kurze Ramp-Überlappung ohne Sendeloch
      fadeInMs = 150;
      const outOverlap =
        next?.kind === "song"
          ? Math.min(JINGLE_OUT_OVERLAP_MS, Math.floor(durationMs / 4), Math.floor(next.track.durationMs / 4))
          : 0;
      fadeOutMs = outOverlap > 0 ? Math.min(500, outOverlap) : 250;
      advance = durationMs - outOverlap;
    }

    items.push({
      kind: cur.kind,
      cycle,
      index: i,
      startsAt: t,
      durationMs,
      fadeInMs,
      fadeOutMs,
      ...(cur.kind === "song" ? { track: cur.track } : { jingle: cur.jingle }),
    });
    t += advance;
  }

  const n = order.length;
  const raw = rawOrder(seed, era, cycle);
  return {
    cycle,
    startsAt,
    endsAt: t,
    items,
    rawTailIds: raw.slice(Math.max(0, n - MAX_SEPARATION)).map((s) => s.id),
  };
}

// ---------------------------------------------------------------------------
// Zeit -> Position
// ---------------------------------------------------------------------------

const cycleCache = new Map<string, BuiltCycle>();
const CACHE_LIMIT = 64;

function cacheKey(seed: string, era: Era, cycle: number): string {
  return `${seed}|${era.startsAt}|${era.songs.length}|${era.jingles.length}|${cycle}`;
}

function prevTailFor(seed: string, eras: readonly Era[], eraIdx: number, cycle: number): string[] {
  const era = eras[eraIdx];
  const src = cycle === era.firstCycle ? eras[eraIdx - 1] : era;
  if (!src || src.songs.length === 0) return [];
  const raw = rawOrder(seed, src, cycle - 1);
  return raw.slice(Math.max(0, raw.length - MAX_SEPARATION)).map((s) => s.id);
}

function getCycle(seed: string, eras: readonly Era[], eraIdx: number, cycle: number, startsAt: number): BuiltCycle {
  const era = eras[eraIdx];
  const key = cacheKey(seed, era, cycle) + `|${startsAt}`;
  const hit = cycleCache.get(key);
  if (hit) return hit;
  const built = buildCycle(seed, era, cycle, startsAt, prevTailFor(seed, eras, eraIdx, cycle));
  if (cycleCache.size >= CACHE_LIMIT) cycleCache.delete(cycleCache.keys().next().value!);
  cycleCache.set(key, built);
  return built;
}

/** Ära-Index, der zum Zeitpunkt `now` gilt (oder -1). */
export function eraIndexAt(eras: readonly Era[], now: number): number {
  for (let i = eras.length - 1; i >= 0; i--) if (eras[i].startsAt <= now) return i;
  return -1;
}

/** Durchlauf finden, der `now` enthält. Iteriert ab Ära-Start (billig: ~1 Durchlauf/4–5 h). */
export function locateCycle(state: StationState, now: number): { eraIdx: number; built: BuiltCycle } | null {
  const eraIdx = eraIndexAt(state.eras, now);
  if (eraIdx < 0) return null;
  const era = state.eras[eraIdx];
  if (era.songs.length === 0) return null;
  let cycle = era.firstCycle;
  let start = era.startsAt;
  // Sicherheitsgrenze gegen Endlosschleifen bei kaputten Daten
  for (let guard = 0; guard < 1_000_000; guard++) {
    const built = getCycle(state.seed, state.eras, eraIdx, cycle, start);
    if (built.endsAt <= start) return null;
    if (now < built.endsAt) return { eraIdx, built };
    start = built.endsAt;
    cycle++;
  }
  return null;
}

/** Nächster Durchlauf nach `cur` (wechselt ggf. in die nächste Ära). */
function nextCycle(state: StationState, eraIdx: number, cur: BuiltCycle): { eraIdx: number; built: BuiltCycle } {
  const nextEra = state.eras[eraIdx + 1];
  if (nextEra && nextEra.startsAt <= cur.endsAt && nextEra.songs.length > 0) {
    return { eraIdx: eraIdx + 1, built: getCycle(state.seed, state.eras, eraIdx + 1, nextEra.firstCycle, cur.endsAt) };
  }
  return { eraIdx, built: getCycle(state.seed, state.eras, eraIdx, cur.cycle + 1, cur.endsAt) };
}

/** Effektives Ende eines Items (bei Crossfade = Start des Nachfolgers + Überlappung). */
export function itemEnd(item: ScheduleItem): number {
  return item.startsAt + item.durationMs;
}

/**
 * Was läuft jetzt? Bei Crossfades überlappen sich zwei Songs; maßgeblich ist der
 * zuletzt gestartete Titel (der neue Song „übernimmt“ mit Beginn der Blende).
 */
export function nowPlaying(state: StationState, now: number, upcomingCount = 5): NowPlaying | null {
  const loc = locateCycle(state, now);
  if (!loc) return null;
  let { eraIdx, built } = loc;

  let idx = -1;
  for (let i = built.items.length - 1; i >= 0; i--) {
    if (built.items[i].startsAt <= now) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return null;
  const item = built.items[idx];

  const upcoming: ScheduleItem[] = [];
  let j = idx + 1;
  while (upcoming.length < upcomingCount) {
    if (j >= built.items.length) {
      ({ eraIdx, built } = nextCycle(state, eraIdx, built));
      j = 0;
      if (built.items.length === 0) break;
    }
    upcoming.push(built.items[j++]);
  }

  return { item, offsetMs: now - item.startsAt, upcoming };
}

// ---------------------------------------------------------------------------
// Neue Ära einplanen (bei Playlist-/Jingle-Änderung)
// ---------------------------------------------------------------------------

function fingerprint(songs: readonly Track[], jingles: readonly Jingle[]): string {
  const s = songs.map((t) => `${t.id}:${t.durationMs}:${t.audioUrl}`).sort().join(",");
  const j = jingles.map((t) => `${t.id}:${t.durationMs}:${t.url}`).sort().join(",");
  return `${s}#${j}`;
}

/**
 * Plant eine neue Ära mit (songs, jingles). Sie startet:
 *  - sofort, wenn bisher nichts läuft,
 *  - sonst am Ende des aktuell laufenden Durchlaufs.
 * Eine noch nicht begonnene (vorgemerkte) Ära wird ersetzt.
 * Gibt `null` zurück, wenn sich nichts geändert hat.
 */
export function planEra(
  state: StationState,
  songs: Track[],
  jingles: Jingle[],
  now: number,
): StationState | null {
  const playable = songs.filter((s) => s.durationMs > 0 && s.audioUrl);
  const eras = state.eras.filter((e) => e.startsAt <= now); // vorgemerkte verwerfen
  const latest = state.eras[state.eras.length - 1];
  if (latest && fingerprint(latest.songs, latest.jingles) === fingerprint(playable, jingles)) return null;

  const loc = locateCycle({ ...state, eras }, now);
  let era: Era;
  if (!loc) {
    const lastCycle = eras.length ? eras[eras.length - 1].firstCycle : -1;
    era = { startsAt: now, firstCycle: lastCycle + 1, songs: playable, jingles };
  } else {
    era = { startsAt: loc.built.endsAt, firstCycle: loc.built.cycle + 1, songs: playable, jingles };
  }

  // Alte Ären aufräumen: nur die aktuelle + neue behalten
  const curIdx = eraIndexAt(eras, now);
  const kept = curIdx >= 0 ? eras.slice(curIdx) : eras;
  return { ...state, eras: [...kept, era] };
}
