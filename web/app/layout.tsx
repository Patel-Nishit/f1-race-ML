import type { Metadata } from "next";
import { Geist_Mono, Titillium_Web } from "next/font/google";
import "./globals.css";

// Titillium Web is close to F1's broadcast typeface; Geist Mono keeps
// changing numbers (lap times, speeds) from jittering in width.
const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Race Replay",
  description: "Replay any Formula 1 race since 2018 with live positions, tyres, safety car and telemetry.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${titillium.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
