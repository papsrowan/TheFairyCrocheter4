// ─────────────────────────────────────────────────────────────────────────────
// PRISMA CLIENT — Singleton pattern pour éviter les connexions multiples
// en développement (hot reload Next.js crée de nouvelles instances)
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "minimal",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Note : pas de $connect() au niveau module — Prisma se connecte lazily
// au premier appel. Un $connect() ici s'exécuterait dans Edge Runtime
// (middleware Next.js) et provoquerait une erreur.

export default prisma;
