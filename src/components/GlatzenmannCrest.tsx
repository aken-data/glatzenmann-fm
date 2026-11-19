export function GlatzenmannCrest({ className = "h-24 w-24" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Glatzenmann Wappen"
    >
      {/* Wappenschild-Kreis */}
      <circle cx="60" cy="60" r="56" fill="#2b1a0e" stroke="#d4a359" strokeWidth="3" />
      <circle cx="60" cy="60" r="50" fill="#7a1c14" stroke="#f4e4c1" strokeWidth="1.2" strokeDasharray="3 3" />

      {/* Gekreuzte Klampfe / Lautenhals im Hintergrund */}
      <line x1="26" y1="94" x2="94" y2="26" stroke="#d4a359" strokeWidth="4" strokeLinecap="round" />
      <line x1="26" y1="26" x2="94" y2="94" stroke="#d4a359" strokeWidth="4" strokeLinecap="round" />

      {/* Glänzender Kopf (Politur!) */}
      <ellipse cx="60" cy="52" rx="22" ry="25" fill="#f5d0a9" stroke="#2b1a0e" strokeWidth="2.5" />

      {/* Politur-Glanzstern */}
      <path
        d="M49 35 L51 40 L56 42 L51 44 L49 49 L47 44 L42 42 L47 40 Z"
        fill="#fff8e7"
      />

      {/* Heldenkranz (Haarkranz an den Seiten) */}
      <path
        d="M38 50 C34 50, 34 62, 39 63"
        stroke="#2b1a0e"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M82 50 C86 50, 86 62, 81 63"
        stroke="#2b1a0e"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Augen / Sonnenbrillen-Blick */}
      <circle cx="52" cy="52" r="2.3" fill="#2b1a0e" />
      <circle cx="68" cy="52" r="2.3" fill="#2b1a0e" />

      {/* Gepflegter Bart ("Brauche meine Bürste nur noch für den Bart") */}
      <path
        d="M42 62 C42 82, 54 90, 60 90 C66 90, 78 82, 78 62 C72 67, 65 66, 60 66 C55 66, 48 67, 42 62 Z"
        fill="#2b1a0e"
      />
      <path d="M48 66 Q60 72 72 66" stroke="#f5d0a9" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
