// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE NEXT.JS — Auth + RBAC sur toutes les routes protégées
// S'exécute sur le Edge Runtime de Next.js avant chaque requête
// ─────────────────────────────────────────────────────────────────────────────

// Import de la version Edge (sans Prisma) — le middleware tourne sur Edge Runtime
import { auth } from "@/lib/auth-edge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

// Routes publiques (sans authentification)
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth",
  "/api/health",
];

// Routes réservées par rôle minimum requis
const PROTECTED_ROUTES: { pattern: RegExp; minRole: Role }[] = [
  { pattern: /^\/finances/, minRole: "MANAGER" },
  { pattern: /^\/utilisateurs/, minRole: "SUPER_ADMIN" },
  { pattern: /^\/parametres/, minRole: "SUPER_ADMIN" },
  { pattern: /^\/api\/finances/, minRole: "MANAGER" },
  { pattern: /^\/api\/utilisateurs/, minRole: "SUPER_ADMIN" },
  { pattern: /^\/api\/parametres/, minRole: "SUPER_ADMIN" },
];

const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  MANAGER: 3,
  CAISSIER: 2,
  DISTRIBUTEUR: 1,
};

export default auth(async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const session = (req as unknown as { auth: { user?: { role: Role } } }).auth;

  // 1. Laisser passer les routes publiques
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublic) return NextResponse.next();

  // 2. Rediriger vers login si non authentifié
  if (!session?.user) {
    // Utiliser NEXTAUTH_URL si défini (ngrok/prod), sinon reconstruire depuis les headers proxy
    const base =
      process.env.NEXTAUTH_URL ??
      (() => {
        const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3001";
        const proto = req.headers.get("x-forwarded-proto") ?? "http";
        return `${proto}://${host}`;
      })();
    const loginUrl = new URL("/login", base);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role as Role;
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;

  // 3. Vérifier les routes avec rôle minimum requis
  for (const { pattern, minRole } of PROTECTED_ROUTES) {
    if (pattern.test(pathname)) {
      const requiredLevel = ROLE_HIERARCHY[minRole];
      if (userLevel < requiredLevel) {
        const base =
          process.env.NEXTAUTH_URL ??
          (() => {
            const host  = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3001";
            const proto = req.headers.get("x-forwarded-proto") ?? "http";
            return `${proto}://${host}`;
          })();
        const dashboardUrl = new URL("/dashboard", base);
        dashboardUrl.searchParams.set("error", "access_denied");
        return NextResponse.redirect(dashboardUrl);
      }
    }
  }

  // 4. Ajouter les headers de sécurité à chaque réponse
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );

  return response;
});

// Appliquer le middleware sur toutes les routes sauf les assets statiques
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|uploads/).*)",
  ],
};
