// ─────────────────────────────────────────────────────────────────────────────
// NEXT.JS CONFIG — PWA + Headers de sécurité + CSP
// ─────────────────────────────────────────────────────────────────────────────

// @ts-check
import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mode standalone pour Docker — Build autonome sans dependencies externes
  output: "standalone",

  // @react-pdf/renderer utilise yoga-layout (WASM) — ne pas bundler côté serveur
  experimental: {
    serverComponentsExternalPackages: [
      "@react-pdf/renderer",
      "@zxing/browser",
      "@zxing/library",
    ],
  },

  // Images servies sans conversion (sharp non disponible en Docker standalone Alpine)
  images: {
    unoptimized: true,
  },

  // Headers de sécurité globaux
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval requis par Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://*.ngrok-free.app https://*.ngrok.io",
              "media-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
      // Headers spécifiques aux documents PDF
      {
        source: "/api/documents/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // Rewrite /uploads/* → API route (standalone ne sert pas les fichiers runtime)
  async rewrites() {
    return [
      {
        source:      "/uploads/:path*",
        destination: "/api/serve-upload/:path*",
      },
    ];
  },

  // Variables d'environnement exposées au client
  env: {
    APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Gestion Commerciale",
  },
};

// Configuration PWA (Progressive Web App)
const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Routes JAMAIS mises en cache (PDF, auth, API dynamiques)
  exclude: [
    /\/api\/documents\//,   // PDF factures et tickets
    /\/api\/auth\//,        // NextAuth
    /\/api\/ventes/,        // données temps réel
    /\/api\/demandes/,
  ],
  runtimeCaching: [
    // Pages de l'app — Network First (offline fallback)
    {
      urlPattern: /^(?!.*\/api\/).*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 8,
        expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    // Cache des assets statiques
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|woff|woff2)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
        },
      },
    },
    // Cache des appels API en lecture (GET)
    {
      urlPattern: /^\/api\/(produits|clients)(\?.*)?$/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
      },
    },
  ],
});

export default pwaConfig(nextConfig);
