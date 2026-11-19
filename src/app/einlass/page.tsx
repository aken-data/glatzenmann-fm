"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GlatzenmannCrest } from "@/components/GlatzenmannCrest";
import { MedievalBackdrop } from "@/components/MedievalBackdrop";
import { MedievalScroll } from "@/components/MedievalScroll";

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
    <main className="relative min-h-screen px-4 py-8 sm:py-12 flex items-center justify-center">
      <MedievalBackdrop />

      <div className="w-full max-w-xl text-[#26160a]">
        <MedievalScroll>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-medieval-serif)] text-xs tracking-[0.22em] uppercase text-[#5c3618]">
                Anno Domini MMXXVI • Kundmachung
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-medieval-display)] text-4xl sm:text-5xl leading-tight text-[#1e1005]">
                Höret, höret!
              </h1>
              <p className="font-[family-name:var(--font-medieval-display)] text-2xl sm:text-3xl text-[#7a1c14]">
                Willkommen bei Glatzenmann.fm
              </p>
            </div>

            <div className="relative shrink-0 flex flex-col items-center">
              <div className="h-14 w-14 overflow-hidden rounded-full border-2 border-[#450a0a] shadow-[0_6px_14px_rgba(0,0,0,0.55)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/wax-seal.jpg"
                  alt="Wachssiegel"
                  className="h-full w-full object-cover scale-[1.28]"
                />
              </div>
              <div className="-mt-2 flex gap-1 pointer-events-none" aria-hidden>
                <span className="h-5 w-2 bg-[#7a1c14] rotate-[8deg] shadow-sm" />
                <span className="h-5 w-2 bg-[#5e140e] -rotate-[8deg] shadow-sm" />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 border-y border-[#4a2b13]/30 py-3">
            <GlatzenmannCrest className="h-14 w-14 shrink-0" />
            <p className="font-[family-name:var(--font-medieval-serif)] text-base sm:text-lg leading-snug text-[#2b190b]">
              Tretet ein zum Gelage! Nennt am Stadttor das geheime Losungswort, so stimmen wir
              gemeinsam die Klampfe an.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-5 border-2 border-dashed border-[#4a2b13]/70 bg-[#dfd0ab]/55 p-4 sm:p-5"
          >
            <label
              htmlFor="losungswort"
              className="block text-center font-[family-name:var(--font-medieval-serif)] text-base font-bold text-[#2b190b]"
            >
              Losungswort:
            </label>

            <div className="mt-2.5 flex flex-col sm:flex-row gap-3">
              <input
                id="losungswort"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Geheimes Losungswort…"
                className="flex-1 border-2 border-[#3b2412] bg-[#f6ecd2] px-4 py-2 font-[family-name:var(--font-mono)] text-sm text-[#1e1005] placeholder:text-[#8c7250] focus:outline-none focus:ring-2 focus:ring-[#7a1c14]"
              />
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer border-2 border-[#261209] bg-[#7a1c14] px-6 py-2 font-[family-name:var(--font-medieval-display)] text-xl tracking-wide text-[#f7e7c4] shadow-[0_3px_0_#261209] transition active:translate-y-[2px] active:shadow-none hover:bg-[#912219] disabled:opacity-60"
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

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#4a2b13]/30 pt-3 font-[family-name:var(--font-medieval-serif)] text-xs text-[#5c3618]">
            <span>Glatzenmann.fm • Eintritt frei</span>
            <a href="/admin" className="underline decoration-dotted hover:text-[#1e1005]">
              Kammer des Vogts (/admin)
            </a>
          </footer>
        </MedievalScroll>
      </div>
    </main>
  );
}
