// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/produits — Liste paginée avec filtres
// POST /api/produits — Créer un nouveau produit
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { createProduitSchema } from "@/lib/validations/produit.schema";
import { generateBarcode } from "@/lib/utils/barcode";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role, Prisma } from "@prisma/client";

// ─── GET /api/produits ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const limited = checkRateLimit(req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown", RATE_LIMITS.api);
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { searchParams } = req.nextUrl;
  const page    = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit   = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const search  = searchParams.get("search")?.trim() ?? "";
  const catId   = searchParams.get("categorieId") ?? "";
  const actif   = searchParams.get("actif");
  const alerte  = searchParams.get("alerte") === "true"; // stock sous le minimum

  const where: Prisma.ProduitWhereInput = {};

  if (search) {
    where.OR = [
      { nom: { contains: search, mode: "insensitive" } },
      { codeBarres: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (catId)  where.categorieId = catId;
  if (actif !== null && actif !== "") where.actif = actif === "true";
  if (alerte) where.stockActuel = { lt: prisma.produit.fields.stockMinimum as unknown as number };
  // Exclure les produits soft-supprimés
  where.deletedAt = null;

  // Pour le filtre alerte, on utilise une requête brute plus simple
  const skip = (page - 1) * limit;

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where: alerte
        ? { ...where, stockActuel: undefined }
        : where,
      include: { categorie: true, _count: { select: { variantes: true } } },
      orderBy: { nom: "asc" },
      skip,
      take: limit,
    }),
    prisma.produit.count({ where: alerte ? { ...where, stockActuel: undefined } : where }),
  ]);

  // Filtre alerte en post-traitement (stockActuel < stockMinimum)
  const data = alerte
    ? produits.filter((p) => p.stockActuel < p.stockMinimum)
    : produits;

  return NextResponse.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ─── POST /api/produits ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:create")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown", RATE_LIMITS.api);
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const body = await req.json();
  const parsed = createProduitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;
  const vars = data.variantes ?? [];

  // Stock total = somme des variantes si elles existent
  if (vars.length > 0) {
    data.stockActuel = vars.reduce((s, v) => s + v.stockActuel, 0);
  }

  const resolvedCategorieId: string | null = data.categorieId ?? null;

  // Générer un code-barres EAN-13 unique si non fourni
  let codeBarres = data.codeBarres ?? null;
  if (!codeBarres) {
    let candidate = generateBarcode();
    while (await prisma.produit.findUnique({ where: { codeBarres: candidate } })) {
      candidate = generateBarcode();
    }
    codeBarres = candidate;
  } else {
    const exists = await prisma.produit.findUnique({ where: { codeBarres } });
    if (exists) return NextResponse.json({ error: "Code-barres déjà utilisé" }, { status: 409 });
  }

  let produit;
  try {
    produit = await prisma.produit.create({
      data: {
        nom:             data.nom,
        description:     data.description,
        codeBarres,
        ...(resolvedCategorieId
          ? { categorie: { connect: { id: resolvedCategorieId } } }
          : {}),
        prixVente:       data.prixVente,
        prixGros:        data.prixGros ?? null,
        qtePrixGros:     data.qtePrixGros ?? null,
        prixAchat:       data.prixAchat,
        tauxTVA:         data.tauxTVA,
        stockActuel:     data.stockActuel,
        stockMinimum:    data.stockMinimum,
        imageUrl:        data.imageUrl ?? null,
        couleur:         data.couleur ?? null,
        poids:           data.poids ?? null,
        dateAcquisition: data.dateAcquisition ? new Date(data.dateAcquisition) : null,
        ...(vars.length > 0 ? {
          variantes: { create: vars.map(v => ({ couleur: v.couleur, stockActuel: v.stockActuel })) },
        } : {}),
      },
      include: { categorie: true, variantes: true },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/produits]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Si stock initial > 0 → enregistrer le mouvement d'entrée
  if (data.stockActuel > 0) {
    await prisma.mouvementStock.create({
      data: {
        produitId:   produit.id,
        type:        "ENTREE",
        quantite:    data.stockActuel,
        stockAvant:  0,
        stockApres:  data.stockActuel,
        motif:       "Stock initial à la création",
        userId:      session.user.id,
      },
    });
  }

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.PRODUIT_CREATED,
    entityId:   produit.id,
    entityType: "produit",
    details:    { nom: produit.nom, prixVente: produit.prixVente },
  });

  return NextResponse.json(produit, { status: 201 });
}
