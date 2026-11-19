import type { ReactNode } from "react";

/**
 * Realistische mittelalterliche Boten-Papierrolle mit gerollten Pergament-Enden
 * oben und unten sowie gealtertem Pergament-Körper.
 */
export function MedievalScroll({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Oberer gerollter Pergament-Wickel */}
      <div className="scroll-curl-top relative z-10 h-7 w-full rounded-full" />

      {/* Ausgerolltes Pergament */}
      <div className="scroll-paper relative -my-2.5 mx-2.5 px-5 py-6 sm:px-7 sm:py-7">
        {children}
      </div>

      {/* Unterer gerollter Pergament-Wickel */}
      <div className="scroll-curl-bottom relative z-10 h-7 w-full rounded-full" />
    </div>
  );
}
