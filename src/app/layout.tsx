// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT RACINE — Entry point de l'application
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata, Viewport } from "next";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/shared/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "The Fairy Crocheter",
    template: "%s | TFC",
  },
  description: "Gestion commerciale ERP/POS — The Fairy Crocheter",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TFC",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf8f0" },
    { media: "(prefers-color-scheme: dark)",  color: "#1a1008"  },
  ],
  width: "device-width",
  initialScale: 1,
  // maximumScale non défini → permet le pinch-zoom sur les documents PDF
  viewportFit: "cover", // plein écran sur iPhone avec notch
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/TFC0.png" type="image/png" />
        <link rel="apple-touch-icon" href="/TFC0.png" />
      </head>
      <body className="font-sans antialiased">
        <Providers session={session}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
