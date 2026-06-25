// ─────────────────────────────────────────────────────────────────────────────
// POST /api/produits/[id]/stock — Ajustement manuel du stock
// Types : ENTREE | SORTIE_MANUELLE | CORRECTION | INVENTAIRE
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { emitSSE } from "@/lib/realtime/sse";
import { ajusterStockSchema } from "@/lib/validations/produit.schema";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown", RATE_LIMITS.api);
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { id } = await params;
  const body = await req.json();
  const parsed = ajusterStockSchema.safeParse({ ...body, produitId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const { type, quantite, motif, nouveauStock, varianteId } = parsed.data;

  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  if (!produit.actif) return NextResponse.json({ error: "Produit archivé" }, { status: 422 });

  // ── Produit multi-couleur : ajuster la variante ET garder le stock global cohérent ──
  if (varianteId) {
    const variante = await prisma.varianteProduit.findUnique({ where: { id: varianteId } });
    if (!variante || variante.produitId !== id) {
      return NextResponse.json({ error: "Variante introuvable" }, { status: 404 });
    }
    const vAvant = variante.stockActuel;
    let vApres: number;
    switch (type) {
      case "ENTREE":          vApres = vAvant + quantite; break;
      case "SORTIE_MANUELLE": vApres = vAvant - quantite; break;
      case "CORRECTION":      vApres = vAvant + quantite; break;
      case "INVENTAIRE":
        if (nouveauStock === undefined) return NextResponse.json({ error: "nouveauStock requis pour un inventaire" }, { status: 422 });
        vApres = nouveauStock; break;
      default: return NextResponse.json({ error: "Type invalide" }, { status: 422 });
    }
    if (vApres < 0) return NextResponse.json({ error: `Stock couleur insuffisant. Disponible : ${vAvant}` }, { status: 422 });

    const delta  = vApres - vAvant;
    const pAvant = produit.stockActuel;
    const pApres = pAvant + delta;          // le global suit le delta → reste = somme des couleurs
    const qteMvt = Math.abs(delta);
    const motifC = `${motif ?? "Ajustement"} — couleur ${variante.couleur}`;

    const [, , , globalMvt] = await prisma.$transaction([
      prisma.varianteProduit.update({ where: { id: varianteId }, data: { stockActuel: vApres } }),
      prisma.produit.update({ where: { id }, data: { stockActuel: pApres } }),
      // mouvement couleur (historique par variante)
      prisma.mouvementStock.create({ data: {
        produitId: id, varianteId, type, quantite: qteMvt,
        stockAvant: vAvant, stockApres: vApres, motif: motifC, userId: session.user.id,
      }}),
      // mouvement global (alimente Total entrées/sorties + stockActuel)
      prisma.mouvementStock.create({ data: {
        produitId: id, type, quantite: qteMvt,
        stockAvant: pAvant, stockApres: pApres, motif: motifC, userId: session.user.id,
      }}),
    ]);

    emitSSE("stock.updated", { produitId: id, stockActuel: pApres, type });
    await audit({ userId: session.user.id, action: AUDIT_ACTIONS.STOCK_ADJUSTED, entityId: id, entityType: "produit",
      details: { type, quantite: qteMvt, varianteId, couleur: variante.couleur, stockAvant: pAvant, stockApres: pApres, motif } });
    return NextResponse.json({ mouvement: globalMvt, stockActuel: pApres });
  }

  const stockAvant = produit.stockActuel;
  let stockApres: number;

  // Calculer le nouveau stock selon le type de mouvement
  switch (type) {
    case "ENTREE":
      stockApres = stockAvant + quantite;
      break;
    case "SORTIE_MANUELLE":
      stockApres = stockAvant - quantite;
      if (stockApres < 0) {
        return NextResponse.json({ error: `Stock insuffisant. Disponible : ${stockAvant}` }, { status: 422 });
      }
      break;
    case "CORRECTION":
      // quantite = delta positif ou négatif (on accepte la valeur brute)
      stockApres = stockAvant + quantite;
      if (stockApres < 0) {
        return NextResponse.json({ error: "Le stock résultant serait négatif" }, { status: 422 });
      }
      break;
    case "INVENTAIRE":
      // nouveauStock = valeur absolue du stock réel compté
      if (nouveauStock === undefined) {
        return NextResponse.json({ error: "nouveauStock requis pour un inventaire" }, { status: 422 });
      }
      stockApres = nouveauStock;
      break;
    default:
      return NextResponse.json({ error: "Type de mouvement invalide" }, { status: 422 });
  }

  // Transaction atomique : mouvement + mise à jour stock
  const [mouvement] = await prisma.$transaction([
    prisma.mouvementStock.create({
      data: {
        produitId:  id,
        type,
        quantite:   type === "INVENTAIRE" ? Math.abs(stockApres - stockAvant) : quantite,
        stockAvant,
        stockApres,
        motif:      motif ?? null,
        userId:     session.user.id,
      },
    }),
    prisma.produit.update({
      where: { id },
      data:  { stockActuel: stockApres },
    }),
  ]);

  // SSE — alerte si stock passe sous le minimum
  if (stockApres < produit.stockMinimum) {
    emitSSE("stock.alerte", {
      produitId:    id,
      nom:          produit.nom,
      stockActuel:  stockApres,
      stockMinimum: produit.stockMinimum,
    });
  }

  // SSE — mise à jour stock (pour le dashboard temps réel)
  emitSSE("stock.updated", {
    produitId:   id,
    stockActuel: stockApres,
    type,
  });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.STOCK_ADJUSTED,
    entityId:   id,
    entityType: "produit",
    details:    { type, quantite, stockAvant, stockApres, motif },
  });

  return NextResponse.json({
    mouvement,
    stockActuel: stockApres,
  });
}
