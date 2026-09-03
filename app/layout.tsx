import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Jost, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { RegisterSw } from "@/components/pwa/register-sw";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
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
  themeColor: "#12281C",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${jost.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        {children}
        <Toaster position="top-center" />
        <RegisterSw />
      </body>
    </html>
  );
}
