import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { RegisterSw } from "@/components/pwa/register-sw";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Buena Vida OS",
  description: "Tareas internas de Buena Vida Specialty Coffee",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Buena Vida OS" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#12281C",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const supabasePublic = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
  return (
    <html lang="es" className={`${outfit.variable} ${plex.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {supabasePublic.url && supabasePublic.anon ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__BV_SUPABASE__=${JSON.stringify(supabasePublic)};`,
            }}
          />
        ) : null}
        {children}
        <Toaster position="top-center" />
        <RegisterSw />
      </body>
    </html>
  );
}
