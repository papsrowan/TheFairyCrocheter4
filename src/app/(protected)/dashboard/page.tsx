// ─────────────────────────────────────────────────────────────────────────────
// PAGE DASHBOARD — Tableau de bord temps réel
// Server Component : charge les données initiales depuis Prisma
// Client Component (DashboardClient) : SSE + état live
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { NotesTicker } from "@/components/dashboard/NotesTicker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { role } = session.user;
  if (!hasPermission(role, "dashboard:read")) redirect("/");

  const now       = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const debutHier = new Date(debutJour.getTime() - 86_400_000);
  const finHier   = new Date(debutJour.getTime() - 1);
  const il7Jours  = new Date(debutJour.getTime() - 6 * 86_400_000);

  const canFinances = hasPermission(role, "dashboard:finances");
  const isManager = role === "MANAGER";

  const [
    ventesAujourdhui,
    ventesHier,
    produitsActifs,
    clientsActifs,
    ventesRecentes,
    caParJourRaw,
    notesRaw,
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { createdAt: { gte: debutJour }, statut: "COMPLETEE" },
      _count: true,
      _sum:   { total: true },
    }),
    prisma.vente.aggregate({
      where: { createdAt: { gte: debutHier, lte: finHier }, statut: "COMPLETEE" },
      _count: true,
      _sum:   { total: true },
    }),
    prisma.produit.findMany({
      where: { actif: true },
      select: { id: true, nom: true, stockActuel: true, stockMinimum: true, categorie: { select: { nom: true } } },
    }),
    prisma.client.count({
      where: {
        dernierAchat: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        anonymiseLe:  null,
      },
    }),
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
        client:  { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
      },
    }),
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
    // Notes : propres à l'utilisateur + notes envoyées par les managers (prix spécial)
    prisma.note.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { contenu: { contains: "Prix spécial appliqué" } },
        ],
      },
      include: { auteur: { select: { nom: true, prenom: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Construire les alertes
  type ProduitRow = (typeof produitsActifs)[number];
  const produitsAlertes = produitsActifs.filter(
    (p: ProduitRow) => p.stockActuel < p.stockMinimum
  );

  // Construire la série 7 jours (jours sans vente = 0)
  type RawJour = { jour: Date; total: number; nb: bigint };
  const caParJour: Array<{ date: string; total: number; nb: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const date    = new Date(debutJour.getTime() - i * 86_400_000);
    const dateStr = date.toISOString().split("T")[0];
    const row     = caParJourRaw.find(
      (r: RawJour) => new Date(r.jour).toISOString().split("T")[0] === dateStr
    );
    caParJour.push({ date: dateStr, total: row?.total ?? 0, nb: row ? Number(row.nb) : 0 });
  }

  const caAujourdhui = ventesAujourdhui._sum.total ?? 0;
  const caHier       = ventesHier._sum.total ?? 0;
  const evolutionCA  = caHier > 0 ? ((caAujourdhui - caHier) / caHier) * 100 : null;

  const notes = notesRaw.map((n) => ({
    id:        n.id,
    contenu:   n.contenu,
    auteur:    `${n.auteur.prenom ?? ""} ${n.auteur.nom}`.trim(),
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-2">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour, {session.user.prenom}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Intl.DateTimeFormat("fr-FR", {
            weekday: "long",
            day:     "numeric",
            month:   "long",
            year:    "numeric",
          }).format(now)}
        </p>
      </div>

      {/* ── Ticker de notes ──────────────────────────────────────────── */}
      <NotesTicker notes={notes} />

      {/* ── Dashboard temps réel ─────────────────────────────────────── */}
      <DashboardClient
        ventesAujourdhui={{ count: ventesAujourdhui._count, total: caAujourdhui }}
        evolutionCA={evolutionCA}
        produitsAlertes={produitsAlertes}
        clientsActifs={clientsActifs}
        ventesRecentes={ventesRecentes.map((v: (typeof ventesRecentes)[number]) => ({
          ...v,
          createdAt: v.createdAt.toISOString(),
        }))}
        caParJour={caParJour}
        showFinances={canFinances}
        isManager={isManager}
        demandes={isManager ? await (async () => {
          const d = await prisma.demandeApprobation.findMany({
            where: { demandeurId: session.user.id },
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { vente: { select: { numero: true } } },
          });
          return d.map(x => ({ id: x.venteId, type: x.type, statut: x.statut, venteNumero: x.vente.numero, createdAt: x.createdAt.toISOString() }));
        })() : []}
      />
    </div>
  );
}
