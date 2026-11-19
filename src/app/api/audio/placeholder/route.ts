import { NextRequest, NextResponse } from "next/server";

/**
 * Erzeugt eine abspielbare 16-Bit-PCM-WAV-Datei für Platzhalter-Jingles und Demo-Tracks.
 * Damit lassen sich Crossfades, Fade-to-Black und Station-IDs sofort testen,
 * ohne dass externe MP3s vorliegen müssen.
 */
function generateWavBuffer(notes: number[], durationSec: number, isJingle: boolean): Buffer {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  const stepSamples = Math.floor(numSamples / notes.length);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(i / stepSamples));
    const localT = (i % stepSamples) / sampleRate;
    const freq = notes[noteIdx];

    // Sanfte Hüllkurve pro Note + Gesamt-Fade-In/Out
    const noteDur = stepSamples / sampleRate;
    const noteEnv =
      Math.min(1, localT / 0.04) * Math.min(1, Math.max(0, (noteDur - localT) / 0.08));
    const globalEnv =
      Math.min(1, t / 0.15) * Math.min(1, Math.max(0, (durationSec - t) / 0.3));

    // Warmer Klang: Grundton + weiche Oktave/Quinte
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic = 0.35 * Math.sin(2 * Math.PI * freq * (isJingle ? 1.5 : 2) * t);
    const amplitude = (isJingle ? 0.24 : 0.16) * noteEnv * globalEnv;
    const sample = Math.max(-1, Math.min(1, (fundamental + harmonic) * amplitude));

    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  return buffer;
}

const JINGLE_MELODIES: Record<string, { notes: number[]; dur: number }> = {
  // Mittelalterliche Quinten-Fanfare (D - A - F - D - A)
  "1": { notes: [293.66, 440.0, 349.23, 293.66, 440.0], dur: 6 },
  "2": { notes: [329.63, 493.88, 392.0, 440.0, 329.63, 246.94], dur: 7 },
};

const SONG_MELODIES: Record<string, { notes: number[]; dur: number }> = {
  "1": { notes: [220, 261.63, 293.66, 329.63, 293.66, 261.63, 220, 196], dur: 24 },
  "2": { notes: [293.66, 349.23, 392.0, 440.0, 392.0, 349.23, 329.63, 293.66], dur: 26 },
  "3": { notes: [196.0, 246.94, 293.66, 392.0, 329.63, 293.66, 246.94, 196.0], dur: 22 },
  "4": { notes: [261.63, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 261.63], dur: 25 },
  "5": { notes: [246.94, 293.66, 369.99, 440.0, 392.0, 329.63, 293.66, 246.94], dur: 23 },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") === "jingle" ? "jingle" : "song";
  const variant = searchParams.get("variant") || "1";

  const preset =
    kind === "jingle"
      ? JINGLE_MELODIES[variant] ?? JINGLE_MELODIES["1"]
      : SONG_MELODIES[variant] ?? SONG_MELODIES["1"];

  const wav = generateWavBuffer(preset.notes, preset.dur, kind === "jingle");

  return new NextResponse(new Uint8Array(wav), {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.byteLength),
      "Cache-Control": "public, max-age=86400",
      "Accept-Ranges": "bytes",
    },
  });
}
