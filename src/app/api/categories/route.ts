// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/categories — Liste toutes les catégories produits
// POST /api/categories — Créer une catégorie
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { z } from "zod";

const createCategorieSchema = z.object({
  nom: z.string().min(1, "Nom requis").max(100),
});

// ─── GET /api/categories ─────────────────────────────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const categories = await prisma.categorie.findMany({
    orderBy: { nom: "asc" },
    include: { _count: { select: { produits: true } } },
  });

  return NextResponse.json(categories);
}

// ─── POST /api/categories ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:create")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCategorieSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const existing = await prisma.categorie.findUnique({ where: { nom: parsed.data.nom } });
  if (existing) return NextResponse.json({ error: "Catégorie déjà existante" }, { status: 409 });

  const categorie = await prisma.categorie.create({ data: { nom: parsed.data.nom } });

  return NextResponse.json(categorie, { status: 201 });
}
