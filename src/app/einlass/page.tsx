"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlatzenmannCrest } from "@/components/GlatzenmannCrest";

export default function EinlassPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, role: "listener" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Der Torwächter schüttelt das Haupt.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Die Botentaube ist abgestürzt. Versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#150e08] px-4 py-8 sm:py-12 flex items-center justify-center">
      <article className="parchment-bg parchment-woodcut-border relative w-full max-w-2xl px-6 py-9 sm:px-12 sm:py-12 text-[#26160a]">
        {/* Ecken-Ornamente */}
        <span aria-hidden className="absolute top-3 left-3 text-xl text-[#4a2b13] select-none">
          ❦
        </span>
        <span aria-hidden className="absolute top-3 right-3 text-xl text-[#4a2b13] select-none">
          ❦
        </span>
        <span aria-hidden className="absolute bottom-3 left-3 text-xl text-[#4a2b13] select-none">
          ❦
        </span>
        <span aria-hidden className="absolute bottom-3 right-3 text-xl text-[#4a2b13] select-none">
          ❦
        </span>

        {/* Kopfzeile */}
        <p className="text-center font-[family-name:var(--font-medieval-serif)] text-xs sm:text-sm tracking-[0.28em] uppercase text-[#5c3618]">
          Anno Domini MMXXVI • Kundmachung auf dem Marktplatze
        </p>

        <div className="my-3 flex items-center justify-center gap-3 text-[#4a2b13]">
          <span className="h-[1px] w-16 bg-[#4a2b13]" />
          <span className="text-lg">✦</span>
          <span className="h-[1px] w-16 bg-[#4a2b13]" />
        </div>

        {/* Haupttitel in Fraktur */}
        <h1 className="text-center font-[family-name:var(--font-medieval-display)] text-4xl sm:text-6xl leading-tight text-[#1e1005] drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
          Höret, höret!
        </h1>
        <p className="mt-1 text-center font-[family-name:var(--font-medieval-display)] text-2xl sm:text-3xl text-[#7a1c14]">
          Glatzenmann.fm rufet zum Gelage!
        </p>

        {/* Holzschnitt-Wappen */}
        <div className="my-6 flex justify-center">
          <div className="flex items-center gap-4 border-y-2 border-[#3b2412] px-6 py-3">
            <span className="font-[family-name:var(--font-medieval-serif)] text-sm italic text-[#4a2b13]">
              Heldenkranz &amp; Politur
            </span>
            <GlatzenmannCrest className="h-16 w-16 shrink-0 drop-shadow-md" />
            <span className="font-[family-name:var(--font-medieval-serif)] text-sm italic text-[#4a2b13]">
              Indikator für Feinkultur
            </span>
          </div>
        </div>

        {/* Plakat-Text */}
        <div className="space-y-4 font-[family-name:var(--font-medieval-serif)] text-base sm:text-lg leading-relaxed text-[#2b190b]">
          <p className="first-letter:float-left first-letter:mr-2.5 first-letter:font-[family-name:var(--font-medieval-display)] first-letter:text-5xl first-letter:leading-none first-letter:text-[#7a1c14]">
            Kommet herbei, ihr Spielleut, Barden und Freunde der schicken Kahlrasur! Wo einst
            Geheimratsecken waren, erstrahlt nun der güldene <strong>Heldenkranz</strong>: Aus
            Haargel ward Politur, die Bürste dient allein dem Bart – <em>schnipp schnapp ab!</em>
          </p>
          <p>
            Gardisten stehen am Zaun Spalier, während <strong>Glatzenmann.fm</strong> auf der
            klassischen Klampfe alle Hörer im selben Takt vereint – samt Balsam gegen Sonnenbrand
            und kurzen <strong>BREAK</strong>-Rufen zwischen den Gesängen.
          </p>
        </div>

        {/* Losungswort-Kasten */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 border-2 border-dashed border-[#4a2b13] bg-[#dfd0ab]/70 p-5 sm:p-6"
        >
          <label
            htmlFor="losungswort"
            className="block text-center font-[family-name:var(--font-medieval-serif)] text-base sm:text-lg font-bold text-[#2b190b]"
          >
            Nenne das Losungswort am Stadttor:
          </label>

          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <input
              id="losungswort"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Geheimes Losungswort…"
              className="flex-1 border-2 border-[#3b2412] bg-[#f6ecd2] px-4 py-2.5 font-[family-name:var(--font-mono)] text-sm text-[#1e1005] placeholder:text-[#8c7250] focus:outline-none focus:ring-2 focus:ring-[#7a1c14]"
            />
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer border-2 border-[#261209] bg-[#7a1c14] px-6 py-2.5 font-[family-name:var(--font-medieval-display)] text-xl tracking-wide text-[#f7e7c4] shadow-[0_3px_0_#261209] transition active:translate-y-[2px] active:shadow-none hover:bg-[#912219] disabled:opacity-60"
            >
              {pending ? "Prüfe…" : "Einlass begehren!"}
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 text-center font-[family-name:var(--font-medieval-serif)] text-sm font-bold text-[#8b1510]"
            >
              ⚔ {error}
            </p>
          )}
        </form>

        {/* Fußzeile */}
        <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-[#4a2b13]/40 pt-4 font-[family-name:var(--font-medieval-serif)] text-xs text-[#5c3618]">
          <span>Gedruckt &amp; gesiegelt zu Glatzenmann.fm • Eintritt frei</span>
          <a href="/admin" className="underline decoration-dotted hover:text-[#1e1005]">
            Kammer des Vogts (/admin)
          </a>
        </footer>
      </article>
    </main>
  );
}
