// ─────────────────────────────────────────────────────────────────────────────
// HEALTH CHECK — Endpoint de surveillance (non authentifié)
// Utilisé par les clients PWA pour détecter le retour de connexion
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startTime = Date.now();

  try {
    // Vérification de la base de données
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version ?? "0.1.0",
        db: {
          status: "connected",
          latencyMs: dbLatency,
        },
        uptime: process.uptime(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        db: {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
