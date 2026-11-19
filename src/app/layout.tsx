import type { Metadata } from "next";
import { IM_Fell_English, JetBrains_Mono, Space_Grotesk, UnifrakturMaguntia } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const unifraktur = UnifrakturMaguntia({
  weight: "400",
  variable: "--font-medieval-display",
  subsets: ["latin"],
});

const imFell = IM_Fell_English({
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-medieval-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glatzenmann.fm – Synchrones Web-Radio",
  description: "Die hochwohlgeborene Rundfunk-Taverne. Alle Hörer hören dasselbe zur selben Zeit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${unifraktur.variable} ${imFell.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
