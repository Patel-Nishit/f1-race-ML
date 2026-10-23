import type { Metadata, Viewport } from "next";
import { Geist_Mono, Titillium_Web } from "next/font/google";
import { TEAM_THEME_SCRIPT } from "@/lib/teamTheme";
import "./globals.css";

// Titillium Web is close to F1's broadcast typeface; its 700 italic is the
// display style (the forward lean of F1 graphics). Geist Mono, with tabular
// figures, keeps changing numbers (lap times, speeds) from jittering.
const titillium = Titillium_Web({
  variable: "--font-titillium",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "Replay any Formula 1 race since 2018 with live positions, tyres, the safety car and telemetry.";

export const metadata: Metadata = {
  // absolute URLs for social cards; set NEXT_PUBLIC_SITE_URL when deployed
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "F1 Race Replay", template: "%s · F1 Race Replay" },
  description,
  openGraph: { title: "F1 Race Replay", description, type: "website" },
  twitter: { card: "summary_large_image", title: "F1 Race Replay", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0d11" },
    { media: "(prefers-color-scheme: light)", color: "#eef0f3" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script below may add data-team to
    // <html> before React hydrates, which is expected
    <html lang="en" className={`${titillium.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEAM_THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="skip-link">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
