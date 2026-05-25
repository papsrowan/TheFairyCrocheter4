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

  const [
    ventesAujourdhui,
    ventesHier,
    produitsAlertes,
    clientsActifs,
    ventesRecentes,
    caParJourRaw,
  ] = await Promise.all([
    // Ventes d'aujourd'hui
    prisma.vente.aggregate({
      where: { createdAt: { gte: debutJour }, statut: "COMPLETEE" },
      _count: true,
      _sum:   { total: true },
    }),
    // Ventes d'hier
    prisma.vente.aggregate({
      where: { createdAt: { gte: debutHier, lte: finHier }, statut: "COMPLETEE" },
      _count: true,
      _sum:   { total: true },
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
    // CA par jour sur les 7 derniers jours (brut SQL pour performance)
    prisma.$queryRaw<Array<{ jour: Date; total: number; nb: bigint }>>`
      SELECT
        DATE_TRUNC('day', created_at) AS jour,
        SUM(total)::float              AS total,
        COUNT(*)::bigint               AS nb
      FROM ventes
      WHERE created_at >= ${il7Jours}
        AND statut = 'COMPLETEE'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY jour ASC
    `,
  ]);

  // Filtrer les produits réellement en alerte
  const alertes = produitsAlertes.filter((p) => p.stockActuel < p.stockMinimum);

  // Construire la série 7 jours (inclure les jours sans vente à 0)
  const caParJour: Array<{ date: string; total: number; nb: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(debutJour.getTime() - i * 86_400_000);
    const dateStr = date.toISOString().split("T")[0];
    const row = caParJourRaw.find(
      (r) => new Date(r.jour).toISOString().split("T")[0] === dateStr
    );
    caParJour.push({
      date:  dateStr,
      total: row?.total ?? 0,
      nb:    row ? Number(row.nb) : 0,
    });
  }

  // % évolution CA aujourd'hui vs hier
  const caAujourdhui = ventesAujourdhui._sum.total ?? 0;
  const caHier       = ventesHier._sum.total ?? 0;
  const evolutionCA  = caHier > 0 ? ((caAujourdhui - caHier) / caHier) * 100 : null;

  return NextResponse.json({
    ventesAujourdhui: {
      count: ventesAujourdhui._count,
      total: caAujourdhui,
    },
    ventesHier: {
      count: ventesHier._count,
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
