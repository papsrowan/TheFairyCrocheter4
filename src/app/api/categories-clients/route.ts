// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/categories-clients — Liste des catégories de clients
// POST /api/categories-clients — Créer une catégorie
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCategorieClientSchema = z.object({
  nom:    z.string().min(1, "Nom requis").max(100),
  remise: z.number().min(0).max(100).default(0),
});

// ─── GET /api/categories-clients ─────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const categories = await prisma.categorieClient.findMany({
    include: { _count: { select: { clients: true } } },
    orderBy: { nom: "asc" },
  });

  return NextResponse.json(categories);
}

// ─── POST /api/categories-clients ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:create")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createCategorieClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const exists = await prisma.categorieClient.findUnique({ where: { nom: parsed.data.nom } });
  if (exists) {
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });
  }

  const categorie = await prisma.categorieClient.create({
    data: { nom: parsed.data.nom, remise: parsed.data.remise },
  });

  return NextResponse.json(categorie, { status: 201 });
}
