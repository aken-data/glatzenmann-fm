/**
 * Angedeuteter, weichgezeichneter Mittelaltermarkt-Hintergrund (Zelte, Fachwerk,
 * Burgtürme und warmes Fackel-/Laternen-Bokeh) – ohne externe Bild-Requests.
 */
export function MedievalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#120b06]"
    >
      {/* Abendhimmel + warmes Feuer-Bokeh */}
      <div
        className="absolute inset-0 scale-110 blur-xl opacity-85"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 68%, rgba(234, 128, 34, 0.34) 0%, transparent 26%),
            radial-gradient(circle at 52% 72%, rgba(245, 158, 11, 0.28) 0%, transparent 22%),
            radial-gradient(circle at 82% 64%, rgba(217, 70, 24, 0.30) 0%, transparent 28%),
            radial-gradient(circle at 35% 32%, rgba(99, 64, 34, 0.22) 0%, transparent 45%),
            linear-gradient(180deg, #16111c 0%, #24160d 55%, #120b06 100%)
          `,
        }}
      />

      {/* Weichgezeichnete Markt-Silhouette (Türme, Zelte, Wimpel, Fachwerk) */}
      <svg
        viewBox="0 0 1440 700"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-full w-full blur-[7px] opacity-60 scale-105"
      >
        {/* Ferne Burg & Türme */}
        <path
          d="M0 700 L0 450 L90 450 L90 310 L130 220 L170 310 L170 430 L320 430 L320 350 L440 350 L440 460 L600 460 L600 280 L650 180 L700 280 L700 440 L940 440 L940 330 L1080 330 L1080 450 L1240 450 L1240 290 L1290 200 L1340 290 L1340 460 L1440 460 L1440 700 Z"
          fill="#0d0805"
        />

        {/* Marktzelte mit Spitzdächern & Wimpeln */}
        <path d="M80 700 L80 510 L200 410 L320 510 L320 700 Z" fill="#2b1409" />
        <path d="M460 700 L460 525 L590 420 L720 525 L720 700 Z" fill="#3a170c" />
        <path d="M860 700 L860 500 L1000 390 L1140 500 L1140 700 Z" fill="#261308" />
        <path d="M1170 700 L1170 530 L1295 435 L1420 530 L1420 700 Z" fill="#36160b" />

        {/* Fackel- & Laternen-Lichter zwischen den Zelten */}
        <circle cx="200" cy="520" r="24" fill="#f59e0b" opacity="0.55" />
        <circle cx="390" cy="545" r="20" fill="#ea580c" opacity="0.5" />
        <circle cx="590" cy="530" r="28" fill="#fbbf24" opacity="0.5" />
        <circle cx="790" cy="540" r="22" fill="#f97316" opacity="0.55" />
        <circle cx="1000" cy="515" r="26" fill="#f59e0b" opacity="0.5" />
        <circle cx="1295" cy="540" r="24" fill="#ea580c" opacity="0.5" />
      </svg>

      {/* Dunkle Vignette für guten Kontrast */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(18,11,6,0.25) 0%, rgba(10,6,3,0.82) 100%)",
        }}
      />
    </div>
  );
}
