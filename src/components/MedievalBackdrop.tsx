/**
 * Sonniger, freundlicher Mittelalter-Hintergrund (goldene Getreidefelder,
 * sonniges Kopfsteinplaster, Fachwerk und blauer Himmel) mit sanftem Blur.
 */
export function MedievalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#5c4328]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/medieval-sunny-bg.jpg"
        alt=""
        className="h-full w-full object-cover scale-105 blur-[4px] brightness-105 saturate-110"
      />

      {/* Warmes Sonnenlicht-Overlay + sanfte Rand-Vignette für gute Lesbarkeit */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255, 232, 180, 0.08) 0%, rgba(45, 24, 8, 0.36) 100%)",
        }}
      />
    </div>
  );
}
