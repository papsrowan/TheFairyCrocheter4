// ─────────────────────────────────────────────────────────────────────────────
// API /api/produits/search — Recherche instantanée (texte ou code-barres)
// Optimisée pour la caisse POS : réponse rapide, cache SSR
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "produits:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(24, parseInt(searchParams.get("limit") ?? "10"));
  const all   = searchParams.get("all") === "1"; // afficher tous les produits

  // Détecter si c'est un scan code-barres (numérique uniquement)
  const isBarcode = /^\d{4,}$/.test(q);

  const produits = await prisma.produit.findMany({
    where: {
      actif: true,
      deletedAt: null,
      ...(all || q.length < 1
        ? {} // pas de filtre texte → tous les produits actifs
        : isBarcode
          ? { codeBarres: q }
          : {
              OR: [
                { nom:         { contains: q, mode: "insensitive" } },
                { codeBarres:  { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { categorie:   { nom: { contains: q, mode: "insensitive" } } },
              ],
            }),
    },
    select: {
      id: true,
      nom: true,
      codeBarres: true,
      prixVente: true,
      prixGros: true,
      qtePrixGros: true,
      tauxTVA: true,
      stockActuel: true,
      stockMinimum: true,
      imageUrl: true,
      categorie:  { select: { nom: true } },
      variantes:  { select: { id: true, couleur: true, description: true, stockActuel: true }, orderBy: { couleur: "asc" } },
    },
    orderBy: [
      { stockActuel: "desc" }, // Produits en stock d'abord
      { nom: "asc" },
    ],
    take: limit,
  });

  return NextResponse.json(
    { data: produits },
    {
      headers: {
        // Cache court côté navigateur (5 secondes) pour la réactivité du POS
        "Cache-Control": "private, max-age=5",
      },
    }
  );
}
