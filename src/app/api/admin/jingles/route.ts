import { del, put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/auth";
import { driveProxyUrl, extractDriveFileId } from "@/lib/drive";
import { planEra } from "@/lib/schedule";
import { DEFAULT_PLACEHOLDER_JINGLES, loadStationState, saveStationState } from "@/lib/station";
import type { Jingle } from "@/lib/types";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, "admin");
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  const state = await loadStationState();
  const latestEra = state.eras[state.eras.length - 1];
  const currentSongs = latestEra?.songs ?? [];
  const currentJingles = latestEra?.jingles ?? [];

  // Platzhalter entfernen, sobald echte Jingles hochgeladen werden
  const withoutPlaceholders = currentJingles.filter((j) => !j.id.startsWith("placeholder-jingle-"));

  let newJingle: Jingle;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const durationSecRaw = form.get("durationSec");
    const durationSec = Number.parseFloat(typeof durationSecRaw === "string" ? durationSecRaw : "6");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Keine Audiodatei ausgewählt" }, { status: 400 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            "BLOB_READ_WRITE_TOKEN fehlt. Im lokalen Dev-Modus ohne Vercel Blob kannst du stattdessen eine Jingle-URL direkt eintragen.",
        },
        { status: 400 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const id = `jingle-${Date.now()}`;
    const blob = await put(`jingles/${id}-${safeName}`, file, {
      access: "public",
      contentType: file.type || "audio/mpeg",
    });

    newJingle = {
      id,
      title: file.name.replace(/\.[^.]+$/, ""),
      source: "blob",
      url: blob.url,
      durationMs: Math.round((Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 6) * 1000),
    };
  } else {
    const body = (await request.json()) as { url?: string; title?: string; durationSec?: number };
    const rawUrl = body.url?.trim() || "";
    const durationSec = Number(body.durationSec ?? 6);
    if (!rawUrl) {
      return NextResponse.json({ error: "URL fehlt" }, { status: 400 });
    }
    const driveId = rawUrl.includes("drive.google.com") ? extractDriveFileId(rawUrl) : null;
    if (rawUrl.includes("drive.google.com") && !driveId) {
      return NextResponse.json(
        { error: "Konnte keine Google-Drive-Datei-ID aus dem Link lesen." },
        { status: 400 },
      );
    }
    newJingle = {
      id: `${driveId ? "drive" : "jingle"}-${Date.now()}`,
      title: body.title?.trim() || (driveId ? "Drive-Einspieler" : "Audio-Einspieler"),
      source: driveId ? "drive" : "url",
      url: driveId ? driveProxyUrl(driveId) : rawUrl,
      durationMs: Math.round((Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 6) * 1000),
    };
  }

  const nextJingles = [...withoutPlaceholders, newJingle];
  const nextState = planEra(state, currentSongs, nextJingles, Date.now()) ?? state;
  await saveStationState(nextState);
  return NextResponse.json({ state: nextState, jingle: newJingle });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Jingle-ID fehlt" }, { status: 400 });
  }

  const state = await loadStationState();
  const latestEra = state.eras[state.eras.length - 1];
  const currentSongs = latestEra?.songs ?? [];
  const currentJingles = latestEra?.jingles ?? [];

  const target = currentJingles.find((j) => j.id === id);
  if (target && process.env.BLOB_READ_WRITE_TOKEN && target.url.includes("blob.vercel-storage.com")) {
    try {
      await del(target.url);
    } catch (err) {
      console.warn("[admin/jingles] Blob delete failed:", err);
    }
  }

  const remaining = currentJingles.filter((j) => j.id !== id);
  const nextJingles = remaining.length > 0 ? remaining : DEFAULT_PLACEHOLDER_JINGLES;
  const nextState = planEra(state, currentSongs, nextJingles, Date.now()) ?? state;
  await saveStationState(nextState);

  return NextResponse.json({ state: nextState });
}
