// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/stats — Toutes les métriques du dashboard en une requête
// Utilisé par le hook TanStack Query du client pour rafraîchir après SSE
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "dashboard:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const now       = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const debutHier = new Date(debutJour.getTime() - 86_400_000);
  const finHier   = new Date(debutJour.getTime() - 1);
  const il7Jours  = new Date(debutJour.getTime() - 6 * 86_400_000);

  const canFinances = hasPermission(role, "dashboard:finances");

  // Le CA est basé sur les ENCAISSEMENTS réels (écritures), pas sur le total des
  // ventes : ainsi un crédit n'entre dans le CA qu'au fur et à mesure de ses
  // règlements, et les annulations/remboursements (négatifs) sont déjà nets.
  const CA_TYPES = ["RECETTE_VENTE", "REMBOURSEMENT"] as const;

  const [
    nbVentesAujourdhui,
    nbVentesHier,
    caAujourdhuiAgg,
    caHierAgg,
    produitsAlertes,
    clientsActifs,
    ventesRecentes,
    recettes7j,
  ] = await Promise.all([
    // Nombre de ventes du jour (annulées déjà exclues via statut)
    prisma.vente.count({ where: { createdAt: { gte: debutJour }, statut: "COMPLETEE" } }),
    // Nombre de ventes d'hier
    prisma.vente.count({ where: { createdAt: { gte: debutHier, lte: finHier }, statut: "COMPLETEE" } }),
    // CA encaissé aujourd'hui
    prisma.ecritureFinanciere.aggregate({
      where: { type: { in: [...CA_TYPES] }, date: { gte: debutJour } },
      _sum: { montant: true },
    }),
    // CA encaissé hier
    prisma.ecritureFinanciere.aggregate({
      where: { type: { in: [...CA_TYPES] }, date: { gte: debutHier, lte: finHier } },
      _sum: { montant: true },
    }),
    // Produits en alerte de stock
    prisma.produit.findMany({
      where: { actif: true },
      select: {
        id:           true,
        nom:          true,
        stockActuel:  true,
        stockMinimum: true,
        categorie:    { select: { nom: true } },
      },
      orderBy: { nom: "asc" },
    }),
    // Clients ayant acheté ce mois-ci
    prisma.client.count({
      where: {
        dernierAchat: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        anonymiseLe:  null,
      },
    }),
    // 5 dernières ventes complétées
    prisma.vente.findMany({
      where:   { statut: "COMPLETEE" },
      orderBy: { createdAt: "desc" },
      take:    5,
      select: {
        id:           true,
        numero:       true,
        total:        true,
        modePaiement: true,
        createdAt:    true,
        client: { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
      },
    }),
    // Encaissements des 7 derniers jours (regroupés en JS par jour)
    prisma.ecritureFinanciere.findMany({
      where: { type: { in: [...CA_TYPES] }, date: { gte: il7Jours } },
      select: { date: true, montant: true },
    }),
  ]);

  // Filtrer les produits réellement en alerte
  const alertes = produitsAlertes.filter((p) => p.stockActuel < p.stockMinimum);

  // Construire la série 7 jours à partir des encaissements (jours sans CA = 0)
  const caParJour: Array<{ date: string; total: number; nb: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(debutJour.getTime() - i * 86_400_000);
    const dateStr = date.toISOString().split("T")[0];
    const dayItems = recettes7j.filter(
      (r) => r.date.toISOString().split("T")[0] === dateStr
    );
    caParJour.push({
      date:  dateStr,
      total: dayItems.reduce((s, r) => s + r.montant, 0),
      nb:    dayItems.filter((r) => r.montant > 0).length,
    });
  }

  // CA = encaissements nets (recettes + remboursements négatifs)
  const caAujourdhui = caAujourdhuiAgg._sum.montant ?? 0;
  const caHier       = caHierAgg._sum.montant ?? 0;
  const evolutionCA  = caHier > 0 ? ((caAujourdhui - caHier) / caHier) * 100 : null;

  return NextResponse.json({
    ventesAujourdhui: {
      count: nbVentesAujourdhui,
      total: caAujourdhui,
    },
    ventesHier: {
      count: nbVentesHier,
      total: caHier,
    },
    evolutionCA,
    produitsAlertes: alertes,
    clientsActifs,
    ventesRecentes: ventesRecentes.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
    })),
    caParJour,
    // Finances masquées pour CAISSIER
    showFinances: canFinances,
  });
}
