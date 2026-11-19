"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlatzenmannCrest } from "@/components/GlatzenmannCrest";
import { MedievalBackdrop } from "@/components/MedievalBackdrop";
import { nowPlaying } from "@/lib/schedule";
import type { NowPlaying, ScheduleItem, StationState } from "@/lib/types";

interface NowResponse {
  serverTime: number;
  state: StationState;
  current: NowPlaying | null;
}

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

const STRING_WIDTHS = ["w-[2px]", "w-[2px]", "w-[1.5px]", "w-[1.5px]", "w-[1px]", "w-[1px]"];

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function itemUrl(item: ScheduleItem): string {
  return item.kind === "song" ? item.track!.audioUrl : item.jingle!.url;
}

function itemKey(item: ScheduleItem): string {
  return `${item.cycle}:${item.index}:${item.startsAt}`;
}

function itemTitle(item: ScheduleItem): string {
  if (item.kind === "song") return item.track!.title;
  return "BREAK";
}

function computeGain(item: ScheduleItem, serverNow: number): number {
  const elapsed = serverNow - item.startsAt;
  const remaining = item.startsAt + item.durationMs - serverNow;
  let gain = 1;
  if (item.fadeInMs > 0 && elapsed < item.fadeInMs) {
    gain = Math.min(gain, Math.max(0, elapsed / item.fadeInMs));
  }
  if (item.fadeOutMs > 0 && remaining < item.fadeOutMs) {
    gain = Math.min(gain, Math.max(0, remaining / item.fadeOutMs));
  }
  return gain;
}

export function RadioPlayer({ initial }: { initial: NowResponse }) {
  const router = useRouter();
  const [state, setState] = useState<StationState>(initial.state);
  const [clockOffsetMs, setClockOffsetMs] = useState<number>(() => initial.serverTime - Date.now());
  const [tunedIn, setTunedIn] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [nowSnap, setNowSnap] = useState<NowPlaying | null>(initial.current);
  const [audioError, setAudioError] = useState<string | null>(null);

  const deckARef = useRef<HTMLVideoElement | null>(null);
  const deckBRef = useRef<HTMLVideoElement | null>(null);
  const activeDeckRef = useRef<"A" | "B">("A");
  const deckItemsRef = useRef<{ A: ScheduleItem | null; B: ScheduleItem | null }>({
    A: null,
    B: null,
  });
  const preloadedRef = useRef<{ A: string | null; B: string | null }>({ A: null, B: null });

  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  useEffect(() => {
    volumeRef.current = volume;
    mutedRef.current = muted;
  }, [volume, muted]);

  const syncWithServer = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("/api/now", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as NowResponse;
      const rtt = Date.now() - t0;
      setClockOffsetMs(data.serverTime + Math.round(rtt / 2) - Date.now());
      setState(data.state);
    } catch {
      // Stiller Retry beim nächsten Intervall
    }
  }, []);

  useEffect(() => {
    const id = setInterval(syncWithServer, 30_000);
    return () => clearInterval(id);
  }, [syncWithServer]);

  const startItemOnDeck = useCallback(
    (deckKey: "A" | "B", item: ScheduleItem, serverNow: number) => {
      const audio = deckKey === "A" ? deckARef.current : deckBRef.current;
      if (!audio) return;

      const url = itemUrl(item);
      deckItemsRef.current[deckKey] = item;

      if (audio.getAttribute("data-src") !== url) {
        audio.setAttribute("data-src", url);
        audio.src = url;
      }

      const targetVol = (mutedRef.current ? 0 : volumeRef.current) * computeGain(item, serverNow);
      audio.volume = Math.max(0, Math.min(1, targetVol));

      const applySeek = () => {
        const liveNow = Date.now() + clockOffsetMs;
        const offsetSec = Math.max(0, (liveNow - item.startsAt) / 1000);
        if (Number.isFinite(offsetSec) && Math.abs(audio.currentTime - offsetSec) > 0.6) {
          try {
            audio.currentTime = offsetSec;
          } catch {
            // Noch nicht seekbar
          }
        }
      };

      if (audio.readyState >= 1) {
        applySeek();
      } else {
        audio.addEventListener("loadedmetadata", applySeek, { once: true });
      }

      void audio
        .play()
        .then(() => setAudioError(null))
        .catch((err) => {
          setAudioError(
            err instanceof Error
              ? `Der Spielmann schweigt (${err.message}). Klicke erneut auf „Klampfe anstimmen!“.`
              : "Wiedergabe wurde vom Browser blockiert.",
          );
        });
    },
    [clockOffsetMs],
  );

  // Haupt-Sync-Schleife (UI-Fortschritt + Audio-Decks + Crossfade + Preload)
  useEffect(() => {
    const tick = () => {
      const serverNow = Date.now() + clockOffsetMs;
      const np = nowPlaying(state, serverNow, 5);
      setNowSnap(np);

      if (!tunedIn || !np) return;

      const curKey = itemKey(np.item);
      const activeKey = activeDeckRef.current;
      const otherKey = activeKey === "A" ? "B" : "A";
      const activeItem = deckItemsRef.current[activeKey];

      if (!activeItem || itemKey(activeItem) !== curKey) {
        const targetDeck = activeItem ? otherKey : activeKey;
        activeDeckRef.current = targetDeck;
        startItemOnDeck(targetDeck, np.item, serverNow);
      }

      // Nächsten Titel 10 s vor Start auf das freie Deck vorladen (verhindert Puffer-Pause)
      const nextUp = np.upcoming[0];
      if (nextUp && nextUp.startsAt - serverNow <= 10_000 && !deckItemsRef.current[otherKey]) {
        const nextUrl = itemUrl(nextUp);
        const otherEl = otherKey === "A" ? deckARef.current : deckBRef.current;
        if (otherEl && preloadedRef.current[otherKey] !== nextUrl) {
          preloadedRef.current[otherKey] = nextUrl;
          otherEl.setAttribute("data-src", nextUrl);
          otherEl.src = nextUrl;
          otherEl.load();
        }
      }

      for (const dk of ["A", "B"] as const) {
        const audio = dk === "A" ? deckARef.current : deckBRef.current;
        const it = deckItemsRef.current[dk];
        if (!audio || !it) continue;

        const endAt = it.startsAt + it.durationMs;
        if (serverNow >= endAt) {
          if (!audio.paused) audio.pause();
          deckItemsRef.current[dk] = null;
          continue;
        }

        const baseVol = mutedRef.current ? 0 : volumeRef.current;
        const gain = computeGain(it, serverNow);
        audio.volume = Math.max(0, Math.min(1, baseVol * gain));

        if (dk === activeDeckRef.current && !audio.paused && audio.readyState >= 2) {
          const expectedSec = (serverNow - it.startsAt) / 1000;
          if (Math.abs(audio.currentTime - expectedSec) > 1.5) {
            audio.currentTime = Math.max(0, expectedSec);
          }
        }
      }
    };

    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [clockOffsetMs, startItemOnDeck, state, tunedIn]);

  function handleTuneIn() {
    if (tunedIn) {
      deckARef.current?.pause();
      deckBRef.current?.pause();
      deckItemsRef.current = { A: null, B: null };
      setTunedIn(false);
      setAudioError(null);
      return;
    }

    const serverNow = Date.now() + clockOffsetMs;
    const np = nowPlaying(state, serverNow, 5);
    if (deckBRef.current) {
      deckBRef.current.src = SILENT_WAV;
      void deckBRef.current.play().then(() => deckBRef.current?.pause()).catch(() => {});
    }
    if (np) {
      activeDeckRef.current = "A";
      startItemOnDeck("A", np.item, serverNow);
    }

    setTunedIn(true);
    void syncWithServer();
  }

  async function handleLogout() {
    deckARef.current?.pause();
    deckBRef.current?.pause();
    await fetch("/api/auth?role=listener", { method: "DELETE" });
    router.push("/einlass");
    router.refresh();
  }

  const currentItem = nowSnap?.item ?? null;
  const progressPct = useMemo(() => {
    if (!nowSnap) return 0;
    return Math.min(100, Math.max(0, (nowSnap.offsetMs / nowSnap.item.durationMs) * 100));
  }, [nowSnap]);

  return (
    <div className="relative min-h-screen text-[#26160a] flex flex-col">
      <MedievalBackdrop />

      <video
        ref={deckARef}
        preload="auto"
        playsInline
        className="hidden"
        onError={() => setAudioError("Audio-Quelle konnte nicht geladen werden.")}
      />
      <video
        ref={deckBRef}
        preload="auto"
        playsInline
        className="hidden"
        onError={() => setAudioError("Audio-Quelle konnte nicht geladen werden.")}
      />

      {/* Tavernen-Kopfzeile */}
      <header className="border-b border-[#3b2412]/80 bg-[#1c120a]/85 backdrop-blur-sm text-[#e9d9b5]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                tunedIn ? "bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" : "bg-[#6b4c30]"
              }`}
            />
            <span className="font-[family-name:var(--font-medieval-display)] text-xl tracking-wide text-[#f4e4c1]">
              Glatzenmann.fm
            </span>
          </div>

          <div className="flex items-center gap-4 font-[family-name:var(--font-medieval-serif)] text-sm text-[#d8be8a]">
            <Link href="/admin" className="underline decoration-dotted hover:text-[#f7e7c4]">
              Kammer des Vogts
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer underline decoration-dotted hover:text-[#f7e7c4]"
            >
              Tor verlassen
            </button>
          </div>
        </div>
      </header>

      {/* Hauptbühne: Auf Desktop nebeneinander (ohne Scrollen), auf Mobile untereinander */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 px-3 py-4 sm:px-6 sm:py-6">
        <section className="relative flex w-full max-w-[380px] sm:max-w-[410px] shrink-0 flex-col items-center">
          {/* 1. Kopfplatte (Headstock) mit 6 Stimmwirbeln */}
          <div className="relative z-20 flex flex-col items-center">
            <div className="relative flex h-20 w-18 flex-col justify-between rounded-t-xl border-2 border-[#261106] bg-gradient-to-b from-[#45200e] to-[#2c1408] py-2 px-2 shadow-xl">
              {/* Fenster-Kopfplatte (klassische Gitarre) */}
              <div className="pointer-events-none absolute inset-x-3 inset-y-2.5 flex justify-between opacity-35">
                <span className="w-1.5 rounded-full bg-[#120703]" />
                <span className="w-1.5 rounded-full bg-[#120703]" />
              </div>
              {[0, 1, 2].map((row) => (
                <div key={row} className="relative flex items-center justify-between">
                  {/* Linker & Rechter Wirbel */}
                  <span className="-ml-3.5 h-2.5 w-3 rounded-full border border-[#5c3618] bg-[#f4e4c1] shadow" />
                  <span className="-mr-3.5 h-2.5 w-3 rounded-full border border-[#5c3618] bg-[#f4e4c1] shadow" />
                </div>
              ))}
            </div>
            {/* Sattel (Nut) */}
            <div className="h-1.5 w-[66px] border-x border-[#261106] bg-[#f3e5c8]" />
          </div>

          {/* 2. Griffbrett / Hals */}
          <div className="relative z-20 flex h-20 w-[66px] flex-col justify-evenly border-x-2 border-[#1f0d05] bg-[#2a150a] shadow-lg">
            {[0, 1, 2, 3, 4].map((fret) => (
              <span key={fret} className="block h-[2px] w-full bg-[#d4a359]/65" />
            ))}
            {/* 6 Saiten auf dem Griffbrett */}
            <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex w-14 justify-between">
              {STRING_WIDTHS.map((w, idx) => (
                <span
                  key={idx}
                  className={`block h-full ${w} bg-gradient-to-b from-[#f3dfb8] to-[#c79d59] ${
                    tunedIn ? "string-vibrating" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          {/* 3. Klampfen-Korpus (echte Achter-Silhouette per SVG + Inhalte) */}
          <div className="relative -mt-2 w-full">
            {/* SVG Achter-Korpus */}
            <svg
              viewBox="0 0 460 560"
              className="w-full h-auto drop-shadow-[0_28px_50px_rgba(0,0,0,0.8)]"
              aria-hidden
            >
              <defs>
                <radialGradient id="spruceSunburst" cx="50%" cy="42%" r="60%">
                  <stop offset="0%" stopColor="#eab668" />
                  <stop offset="52%" stopColor="#c47835" />
                  <stop offset="88%" stopColor="#7c3a14" />
                  <stop offset="100%" stopColor="#4c1f08" />
                </radialGradient>
              </defs>
              {/* Äußerer Korpus */}
              <path
                d="M230,8
                   C140,8 78,56 78,136
                   C78,186 114,224 114,264
                   C114,306 34,344 34,424
                   C34,514 114,552 230,552
                   C346,552 426,514 426,424
                   C426,344 346,306 346,264
                   C346,224 382,186 382,136
                   C382,56 320,8 230,8 Z"
                fill="url(#spruceSunburst)"
                stroke="#2b1205"
                strokeWidth="8"
              />
              {/* Cremefarbenes Purfling-Binding */}
              <path
                d="M230,16
                   C146,16 88,61 88,136
                   C88,183 123,221 123,264
                   C123,310 44,347 44,424
                   C44,507 120,543 230,543
                   C340,543 416,507 416,424
                   C416,347 337,310 337,264
                   C337,221 372,183 372,136
                   C372,61 314,16 230,16 Z"
                fill="none"
                stroke="#f3d7a4"
                strokeWidth="2.5"
                opacity="0.85"
              />
            </svg>

            {/* 6 Saiten über Schallloch bis zum Steg */}
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 flex w-14 justify-between z-10 opacity-75"
              style={{ height: "58%" }}
            >
              {STRING_WIDTHS.map((w, idx) => (
                <span
                  key={idx}
                  className={`block h-full ${w} bg-gradient-to-b from-[#f3dfb8] via-[#e2bd7c] to-[#9a6f33] ${
                    tunedIn ? "string-vibrating" : ""
                  }`}
                />
              ))}
            </div>

            {/* Schallloch + Rosette (oberer/mittlerer Korpus) */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[9%] sm:top-[10%] z-10">
              <div className="klampfe-rosette relative h-36 w-36 sm:h-44 sm:w-44 rounded-full p-3.5 sm:p-4 flex items-center justify-center">
                <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-[#2b1a0e] bg-[#140b05] shadow-inner flex items-center justify-center">
                  {currentItem?.kind === "song" && currentItem.track?.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentItem.track.coverUrl}
                      alt={currentItem.track.title}
                      className="h-full w-full object-cover sepia-[0.15] contrast-105"
                    />
                  ) : (
                    <GlatzenmannCrest className="h-24 w-24 sm:h-28 sm:w-28" />
                  )}
                </div>
              </div>
            </div>

            {/* Unterbug (Lower Bout): Pergament-Schild + Steg + Steuerung */}
            <div className="absolute inset-x-[12%] bottom-[8%] sm:bottom-[9%] z-20 flex flex-col items-center gap-2.5 sm:gap-3">
              {/* Pergament-Namensschild */}
              <div className="parchment-bg w-full border-2 border-[#3b2412] px-3.5 py-2.5 sm:px-4 sm:py-3 text-center shadow-[0_6px_16px_rgba(0,0,0,0.5)]">
                <div className="flex justify-center">
                  {currentItem?.kind === "jingle" ? (
                    <span className="border border-[#5c3618] bg-[#d4b87c] px-2.5 py-0.5 font-[family-name:var(--font-medieval-serif)] text-[11px] font-bold uppercase tracking-wider text-[#3b2412]">
                      ✦ BREAK
                    </span>
                  ) : (
                    <span className="border border-[#7a1c14] bg-[#7a1c14]/15 px-2.5 py-0.5 font-[family-name:var(--font-medieval-serif)] text-[11px] font-bold uppercase tracking-wider text-[#7a1c14]">
                      ● Auf der Klampfe
                    </span>
                  )}
                </div>

                <h1 className="mt-1.5 font-[family-name:var(--font-medieval-display)] text-2xl sm:text-3xl leading-tight text-[#1e1005] line-clamp-2 break-words">
                  {currentItem ? itemTitle(currentItem) : "Sendepause"}
                </h1>
              </div>

              {/* Steg (Bridge) mit Fortschrittsbalken */}
              <div className="w-[92%] rounded-md border-2 border-[#d4a359]/65 bg-[#2b1409] px-3.5 py-2 shadow-lg">
                <div className="h-2 w-full overflow-hidden rounded-full border border-[#5c3618] bg-[#140904]">
                  <div
                    className={`h-full transition-[width] duration-150 ${
                      currentItem?.kind === "jingle" ? "bg-[#d4a359]" : "bg-[#b91c1c]"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between font-[family-name:var(--font-mono)] text-[11px] text-[#e9d9b5]">
                  <span>{nowSnap ? formatMs(nowSnap.offsetMs) : "0:00"}</span>
                  <span>{currentItem ? formatMs(currentItem.durationMs) : "0:00"}</span>
                </div>
              </div>

              {/* Steuerung: Klampfe anstimmen + Lautstärke */}
              <div className="flex w-full flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTuneIn}
                  className={`cursor-pointer border-2 border-[#261209] px-4 py-2 sm:px-5 font-[family-name:var(--font-medieval-display)] text-lg sm:text-xl tracking-wide shadow-[0_3px_0_#261209] transition active:translate-y-[2px] active:shadow-none ${
                    tunedIn
                      ? "bg-[#2b1409] text-[#f7e7c4] hover:bg-[#3d1e0f]"
                      : "bg-[#7a1c14] text-[#f7e7c4] hover:bg-[#912219]"
                  }`}
                >
                  {tunedIn ? "⏹ Klampfe absetzen" : "▶ Klampfe anstimmen!"}
                </button>

                <div className="flex items-center gap-2 rounded-md border border-[#3b2412] bg-[#f4e4c1]/95 px-2.5 py-1.5 shadow">
                  <button
                    type="button"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Ton an" : "Stumm"}
                    className="cursor-pointer font-[family-name:var(--font-mono)] text-[11px] font-bold text-[#2b190b]"
                  >
                    {muted || volume === 0 ? "STUMM" : `${Math.round(volume * 100)}%`}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={muted ? 0 : volume}
                    onChange={(e) => {
                      setMuted(false);
                      setVolume(Number.parseFloat(e.target.value));
                    }}
                    aria-label="Lautstärke"
                    className="w-20 sm:w-24 accent-[#7a1c14] cursor-pointer"
                  />
                </div>
              </div>

              {audioError && (
                <p
                  className="w-full rounded border border-[#7a1c14] bg-[#f6ecd2] px-3 py-1.5 text-center font-[family-name:var(--font-medieval-serif)] text-xs sm:text-sm font-bold text-[#8b1510]"
                  role="alert"
                >
                  ⚔ {audioError}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Setlist-Pergament: auf Desktop rechts neben der Klampfe, auf Mobile darunter */}
        <section className="parchment-bg parchment-woodcut-border relative w-full max-w-[410px] lg:max-w-md flex-1 px-5 py-4 sm:px-7 sm:py-6">
          <h2 className="font-[family-name:var(--font-medieval-display)] text-xl sm:text-2xl text-[#1e1005]">
            Demnächst auf dem Spielplan
          </h2>

          <ul className="mt-2.5 divide-y divide-[#4a2b13]/25">
            {(nowSnap?.upcoming ?? []).slice(0, 4).map((up) => (
              <li
                key={itemKey(up)}
                className="flex items-center justify-between py-2 font-[family-name:var(--font-medieval-serif)] text-sm sm:text-base gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 text-[10px] sm:text-[11px] uppercase tracking-wider ${
                      up.kind === "jingle"
                        ? "border-[#5c3618] bg-[#d4b87c] text-[#3b2412] font-bold"
                        : "border-[#4a2b13]/40 bg-[#dfd0ab] text-[#4a2b13]"
                    }`}
                  >
                    {up.kind === "jingle" ? "BREAK" : "Lied"}
                  </span>
                  <span className="truncate text-[#1e1005]">{itemTitle(up)}</span>
                </div>
                <span className="shrink-0 font-[family-name:var(--font-mono)] text-xs text-[#5c3618]">
                  {formatMs(up.durationMs)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
