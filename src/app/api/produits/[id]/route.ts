// ─────────────────────────────────────────────────────────────────────────────
// GET   /api/produits/[id] — Détail complet
// PATCH /api/produits/[id] — Modifier un produit
// DELETE /api/produits/[id] — Archiver (soft delete)
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { updateProduitSchema } from "@/lib/validations/produit.schema";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/produits/[id] ───────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const produit = await prisma.produit.findUnique({
    where: { id },
    include: {
      categorie: true,
      variantes: true,
      mouvementsStock: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { produit: { select: { nom: true } } },
      },
      _count: { select: { lignesVente: true } },
    },
  });

  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  return NextResponse.json(produit);
}

// ─── PATCH /api/produits/[id] ─────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown", RATE_LIMITS.api);
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { id } = await params;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const body = await req.json();
  const parsed = updateProduitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const vars = data.variantes ?? [];

  // Vérifier unicité du code-barres si modifié
  if (data.codeBarres && data.codeBarres !== produit.codeBarres) {
    const exists = await prisma.produit.findUnique({ where: { codeBarres: data.codeBarres } });
    if (exists) return NextResponse.json({ error: "Code-barres déjà utilisé" }, { status: 409 });
  }

  // Stock final : somme des variantes si elles sont fournies, sinon valeur existante
  const newStockActuel = vars.length > 0
    ? vars.reduce((s, v) => s + v.stockActuel, 0)
    : data.stockActuel;

  const resolvedCategorieId: string | null | undefined = data.categorieId;

  const updated = await prisma.$transaction(async (tx) => {
    // 1. Mettre à jour le produit
    const p = await tx.produit.update({
      where: { id },
      data: {
        ...(data.nom             !== undefined && { nom: data.nom }),
        ...(data.description     !== undefined && { description: data.description }),
        ...(data.codeBarres      !== undefined && { codeBarres: data.codeBarres }),
        ...(resolvedCategorieId !== undefined && resolvedCategorieId !== null && {
          categorie: { connect: { id: resolvedCategorieId } },
        }),
        ...(resolvedCategorieId === null && { categorie: { disconnect: true } }),
        ...(data.prixVente       !== undefined && { prixVente: data.prixVente }),
        ...(data.prixGros        !== undefined && { prixGros: data.prixGros }),
        ...(data.qtePrixGros     !== undefined && { qtePrixGros: data.qtePrixGros }),
        ...(data.prixAchat       !== undefined && { prixAchat: data.prixAchat }),
        ...(data.tauxTVA         !== undefined && { tauxTVA: data.tauxTVA }),
        ...(data.stockMinimum    !== undefined && { stockMinimum: data.stockMinimum }),
        ...(data.imageUrl        !== undefined && { imageUrl: data.imageUrl }),
        ...(data.couleur         !== undefined && { couleur: data.couleur }),
        ...(data.poids           !== undefined && { poids: data.poids }),
        ...(data.dateAcquisition !== undefined && { dateAcquisition: data.dateAcquisition ? new Date(data.dateAcquisition) : null }),
        ...(newStockActuel !== undefined && { stockActuel: newStockActuel }),
      },
      include: { categorie: true, variantes: true },
    });

    // 2. Synchroniser les variantes si fournies
    if (data.variantes !== undefined) {
      // Supprimer les anciennes variantes
      await tx.varianteProduit.deleteMany({ where: { produitId: id } });
      // Recréer les nouvelles
      if (vars.length > 0) {
        await tx.varianteProduit.createMany({
          data: vars.map(v => ({
            produitId:   id,
            couleur:     v.couleur,
            stockActuel: v.stockActuel,
          })),
        });
      }
      // Mouvement de correction si le stock a changé
      if (newStockActuel !== undefined && newStockActuel !== produit.stockActuel) {
        await tx.mouvementStock.create({
          data: {
            produitId:  id,
            type:       "CORRECTION",
            quantite:   Math.abs(newStockActuel - produit.stockActuel),
            stockAvant: produit.stockActuel,
            stockApres: newStockActuel,
            motif:      "Mise à jour des couleurs et stocks",
            userId:     session.user.id,
          },
        });
      }
    }

    return p;
  });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.PRODUIT_UPDATED,
    entityId:   id,
    entityType: "produit",
    details:    { avant: { nom: produit.nom, prixVente: produit.prixVente }, apres: data },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/produits/[id] ────────────────────────────────────────────────
// ?action=archive  → actif=false, historique conservé (défaut)
// ?action=delete   → suppression définitive SUPER_ADMIN uniquement (si aucune vente)
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  const action = new URL(req.url).searchParams.get("action") ?? "archive";

  if (action === "purge") {
    // Suppression définitive — SUPER_ADMIN uniquement
    if (role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Réservé au Super Admin" }, { status: 403 });
    }
    // Vérifier qu'aucune vente ne référence ce produit
    const nbVentes = await prisma.ligneVente.count({ where: { produitId: id } });
    if (nbVentes > 0) {
      return NextResponse.json({
        error: `Impossible de supprimer : ${nbVentes} vente(s) référencent ce produit. Utilisez Archiver à la place.`,
      }, { status: 409 });
    }
    // Supprimer mouvements, variantes puis produit
    await prisma.$transaction([
      prisma.mouvementStock.deleteMany({ where: { produitId: id } }),
      prisma.varianteProduit.deleteMany({ where: { produitId: id } }),
      prisma.produit.delete({ where: { id } }),
    ]);
    await audit({ userId: session.user.id, action: "produit.purged", entityId: id, entityType: "produit", details: { nom: produit.nom } });
    return NextResponse.json({ success: true, purged: true });
  }

  // Archive (défaut) : masquer sans effacer l'historique
  await prisma.produit.update({ where: { id }, data: { actif: false, deletedAt: new Date() } });
  await audit({ userId: session.user.id, action: AUDIT_ACTIONS.PRODUIT_ARCHIVED, entityId: id, entityType: "produit", details: { nom: produit.nom } });
  return NextResponse.json({ success: true });
}
