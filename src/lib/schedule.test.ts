import assert from "node:assert/strict";
import test from "node:test";
import { buildCycle, jingleGroups, nowPlaying, planEra } from "./schedule.ts";
import type { Era, Jingle, StationState, Track } from "./types.ts";

function makeSongs(count: number): Track[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `song-${String(i).padStart(3, "0")}`,
    title: `Song ${i + 1}`,
    audioUrl: `https://example.com/${i}.mp3`,
    coverUrl: null,
    durationMs: 180_000 + (i % 5) * 10_000,
  }));
}

const JINGLES: Jingle[] = [
  { id: "j1", url: "https://example.com/j1.mp3", durationMs: 6000 },
  { id: "j2", url: "https://example.com/j2.mp3", durationMs: 7000 },
];

test("jingleGroups immer aus 2 und 3 und summiert exakt auf n", () => {
  for (let n = 2; n <= 80; n++) {
    const groups = jingleGroups("test-seed", n, n);
    const sum = groups.reduce((a, b) => a + b, 0);
    assert.equal(sum, n, `Summe für n=${n} muss ${n} sein`);
    for (const g of groups) {
      assert.ok(g === 2 || g === 3, `Gruppe ${g} bei n=${n} muss 2 oder 3 sein`);
    }
  }
});

test("keine direkten Wiederholungen an Durchlauf-Grenzen", () => {
  const era: Era = {
    startsAt: 1_000_000,
    firstCycle: 0,
    songs: makeSongs(70),
    jingles: JINGLES,
  };
  const c0 = buildCycle("seed", era, 0, era.startsAt, []);
  const c1 = buildCycle("seed", era, 1, c0.endsAt, c0.rawTailIds);

  const c0LastSongs = c0.items.filter((i) => i.kind === "song").slice(-5).map((i) => i.track!.id);
  const c1FirstSongs = c1.items.filter((i) => i.kind === "song").slice(0, 5).map((i) => i.track!.id);

  for (const id of c1FirstSongs) {
    assert.ok(!c0LastSongs.includes(id), `Song ${id} wiederholt sich an Durchlauf-Grenze`);
  }
});

test("nowPlaying ist deterministisch und planEra greift erst am Durchlauf-Ende", () => {
  const base: StationState = {
    version: 1,
    seed: "seed-1",
    playlistUrl: null,
    eras: [],
    lastRefresh: null,
  };
  const t0 = 1_700_000_000_000;
  const s1 = planEra(base, makeSongs(10), JINGLES, t0)!;
  assert.ok(s1);

  const npA = nowPlaying(s1, t0 + 45_000);
  const npB = nowPlaying(s1, t0 + 45_000);
  assert.deepEqual(npA, npB);

  const s2 = planEra(s1, makeSongs(12), JINGLES, t0 + 45_000)!;
  assert.equal(s2.eras.length, 2);
  assert.ok(s2.eras[1].startsAt > t0 + 45_000, "Neue Ära startet erst nach aktuellem Durchlauf");
});
