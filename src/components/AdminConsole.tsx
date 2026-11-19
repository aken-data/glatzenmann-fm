"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { StationState } from "@/lib/types";

export function AdminConsole({ initialState }: { initialState: StationState | null }) {
  const [authed, setAuthed] = useState(Boolean(initialState));
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [state, setState] = useState<StationState | null>(initialState);
  const [playlistUrl, setPlaylistUrl] = useState(initialState?.playlistUrl ?? "");
  const [jinglePlaylistUrl, setJinglePlaylistUrl] = useState(
    initialState?.jinglePlaylistUrl ?? "",
  );
  const [driveFolderUrl, setDriveFolderUrl] = useState(initialState?.driveFolderUrl ?? "");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Jingle-Formular
  const [jingleUrl, setJingleUrl] = useState("");
  const [jingleTitle, setJingleTitle] = useState("");
  const [jingleDur, setJingleDur] = useState("6");
  const [jingleFile, setJingleFile] = useState<File | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, role: "admin" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(data.error || "Zugriff verweigert");
        return;
      }
      const stateRes = await fetch("/api/admin/state");
      if (stateRes.ok) {
        const sData = (await stateRes.json()) as { state: StationState };
        setState(sData.state);
        setPlaylistUrl(sData.state.playlistUrl ?? "");
        setJinglePlaylistUrl(sData.state.jinglePlaylistUrl ?? "");
        setDriveFolderUrl(sData.state.driveFolderUrl ?? "");
      }
      setAuthed(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleRefresh(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refresh",
          playlistUrl,
          jinglePlaylistUrl,
          driveFolderUrl,
        }),
      });
      const data = (await res.json()) as { state?: StationState; message?: string; error?: string };
      if (data.state) setState(data.state);
      setStatusMsg(data.message || data.error || "Fertig.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddJingleFile(e: FormEvent) {
    e.preventDefault();
    if (!jingleFile) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", jingleFile);
      fd.append("durationSec", jingleDur || "6");
      const res = await fetch("/api/admin/jingles", { method: "POST", body: fd });
      const data = (await res.json()) as { state?: StationState; error?: string };
      if (!res.ok) {
        setStatusMsg(data.error || "Upload fehlgeschlagen.");
        return;
      }
      if (data.state) setState(data.state);
      setJingleFile(null);
      setStatusMsg("Jingle hochgeladen – gilt ab dem nächsten Durchlauf.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddJingleUrl(e: FormEvent) {
    e.preventDefault();
    if (!jingleUrl.trim()) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin/jingles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: jingleUrl.trim(),
          title: jingleTitle.trim() || undefined,
          durationSec: Number(jingleDur) || 6,
        }),
      });
      const data = (await res.json()) as { state?: StationState; error?: string };
      if (!res.ok) {
        setStatusMsg(data.error || "Fehler beim Speichern.");
        return;
      }
      if (data.state) setState(data.state);
      setJingleUrl("");
      setJingleTitle("");
      setStatusMsg("Jingle hinzugefügt – gilt ab dem nächsten Durchlauf.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteJingle(id: string) {
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/admin/jingles?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { state?: StationState };
      if (data.state) setState(data.state);
      setStatusMsg("Jingle entfernt.");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-xl"
        >
          <h1 className="font-mono text-lg font-bold text-zinc-100">
            Glatzenmann.fm • Admin-Login
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Geschützter Bereich für Playlist-URL, Song-Abgleich und Station-ID-Jingles.
          </p>
          <input
            type="password"
            required
            autoFocus
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Admin-Passwort (Env: ADMIN_PASSWORD)"
            className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {loginError && <p className="mt-2 text-xs text-red-400">{loginError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full cursor-pointer rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-sm text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Prüfe…" : "Anmelden"}
          </button>
          <div className="mt-4 text-center">
            <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Zurück zum Radio
            </Link>
          </div>
        </form>
      </main>
    );
  }

  const latestEra = state?.eras[state.eras.length - 1] ?? null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="font-mono text-xl font-bold">Glatzenmann.fm • Vogt-Kammer (/admin)</h1>
            <p className="text-xs text-zinc-400">
              Änderungen an Songs oder Jingles greifen automatisch ab dem nächsten Durchlauf.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/" className="rounded-lg border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900">
              Zum Radio →
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth?role=admin", { method: "DELETE" });
                setAuthed(false);
              }}
              className="cursor-pointer rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
            >
              Logout
            </button>
          </div>
        </header>

        {statusMsg && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 text-sm text-amber-200">
            {statusMsg}
          </div>
        )}

        {/* Suno Playlists */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-mono text-sm font-semibold text-zinc-200">
            1. Öffentliche Suno-Playlists (Songs &amp; Einspieler)
          </h2>
          <form onSubmit={handleRefresh} className="mt-3 space-y-3">
            <div>
              <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                Song-Playlist (Suno Public Playlist)
              </label>
              <input
                type="url"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://suno.com/playlist/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 font-mono text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                Einspieler-/Jingle-Playlist (separate Suno Public Playlist, optional)
              </label>
              <input
                type="url"
                value={jinglePlaylistUrl}
                onChange={(e) => setJinglePlaylistUrl(e.target.value)}
                placeholder="https://suno.com/playlist/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 font-mono text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                Google-Drive-Ordner für eigene Audio-Schnipsel (öffentlich, optional)
              </label>
              <input
                type="url"
                value={driveFolderUrl}
                onChange={(e) => setDriveFolderUrl(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 font-mono text-xs text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? "Lade…" : "Speichern & neu laden"}
            </button>
          </form>
          {state?.lastRefresh && (
            <p className="mt-2.5 font-mono text-xs text-zinc-400">
              Letzter Abgleich ({new Date(state.lastRefresh.at).toLocaleString("de-DE")}):{" "}
              <span className={state.lastRefresh.ok ? "text-emerald-400" : "text-red-400"}>
                {state.lastRefresh.message}
              </span>
            </p>
          )}
        </section>

        {/* Jingles */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <h2 className="font-mono text-sm font-semibold text-zinc-200">
            2. Station-ID-Jingles ({latestEra?.jingles.length ?? 0})
          </h2>

          <ul className="divide-y divide-zinc-800">
            {(latestEra?.jingles ?? []).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-zinc-200 truncate">
                      {j.title || j.id}
                    </span>
                    {j.source && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                        {j.source}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-500 truncate">
                    {(j.durationMs / 1000).toFixed(1)} s • {j.url}
                  </div>
                </div>
                <audio controls preload="none" src={j.url} className="h-8 max-w-[200px]" />
                <button
                  type="button"
                  onClick={() => handleDeleteJingle(j.id)}
                  className="cursor-pointer rounded border border-red-900/60 px-2.5 py-1 text-xs text-red-400 hover:bg-red-950/50"
                >
                  Löschen
                </button>
              </li>
            ))}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-zinc-800">
            <form onSubmit={handleAddJingleFile} className="space-y-2">
              <div className="text-xs font-semibold text-zinc-300">Datei hochladen (Vercel Blob)</div>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setJingleFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  step="0.5"
                  value={jingleDur}
                  onChange={(e) => setJingleDur(e.target.value)}
                  placeholder="Sek."
                  className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
                />
                <button
                  type="submit"
                  disabled={busy || !jingleFile}
                  className="cursor-pointer rounded bg-zinc-800 px-3 py-1 text-xs font-medium hover:bg-zinc-700 disabled:opacity-40"
                >
                  Hochladen
                </button>
              </div>
            </form>

            <form onSubmit={handleAddJingleUrl} className="space-y-2">
              <div className="text-xs font-semibold text-zinc-300">
                Google-Drive-Link oder Audio-URL hinzufügen
              </div>
              <input
                type="text"
                value={jingleTitle}
                onChange={(e) => setJingleTitle(e.target.value)}
                placeholder="Titel (z. B. Heroldsruf – Met-Rabatt)"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs"
              />
              <input
                type="url"
                value={jingleUrl}
                onChange={(e) => setJingleUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/.../view oder .mp3-URL"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  step="0.5"
                  value={jingleDur}
                  onChange={(e) => setJingleDur(e.target.value)}
                  placeholder="Sek."
                  className="w-20 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
                />
                <span className="text-[11px] text-zinc-500">Sek. Dauer</span>
                <button
                  type="submit"
                  disabled={busy || !jingleUrl.trim()}
                  className="ml-auto cursor-pointer rounded bg-zinc-800 px-3 py-1 text-xs font-medium hover:bg-zinc-700 disabled:opacity-40"
                >
                  Hinzufügen
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Geladene Songs */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="font-mono text-sm font-semibold text-zinc-200">
            3. Aktuelle Songliste ({latestEra?.songs.length ?? 0} Titel)
          </h2>
          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-zinc-800/70">
            {(latestEra?.songs ?? []).map((t, idx) => (
              <div key={t.id} className="flex items-center justify-between py-2 text-xs gap-3">
                <span className="truncate text-zinc-200">
                  <span className="font-mono text-zinc-500 mr-2">{idx + 1}.</span>
                  {t.title}
                </span>
                <span className="shrink-0 font-mono text-zinc-500">
                  {Math.round(t.durationMs / 1000)} s
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
