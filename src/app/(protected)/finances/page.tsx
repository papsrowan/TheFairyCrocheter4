import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/security/rbac";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart,
  Package, Users, ArrowRight, BarChart3, AlertCircle, Clock,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Finances" };
export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const session = await auth();
  if (!hasPermission(session!.user.role as Role, "finances:read")) redirect("/dashboard");

  const now   = new Date();
  const debutMoisActuel   = new Date(now.getFullYear(), now.getMonth(), 1);
  const debutMoisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMoisPrecedent   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const debutAnnee         = new Date(now.getFullYear(), 0, 1);
  const debut7j            = new Date(now); debut7j.setDate(now.getDate() - 6);

  const [
    statsMoisActuel, statsMoisPrecedent, statsAnnee,
    ventesParJour, topProduits, nbClients, nbProduitsActifs,
    facturesEnAttente,
  ] = await Promise.all([
    // Stats mois actuel
    prisma.ecritureFinanciere.groupBy({
      by: ["type"],
      where: { date: { gte: debutMoisActuel } },
      _sum: { montant: true },
    }),
    // Stats mois précédent
    prisma.ecritureFinanciere.groupBy({
      by: ["type"],
      where: { date: { gte: debutMoisPrecedent, lte: finMoisPrecedent } },
      _sum: { montant: true },
    }),
    // Stats année
    prisma.ecritureFinanciere.groupBy({
      by: ["type"],
      where: { date: { gte: debutAnnee } },
      _sum: { montant: true },
    }),
    // Ventes des 7 derniers jours (pour graphique)
    prisma.$queryRaw<Array<{ jour: Date; total: number; nb: bigint }>>`
      SELECT DATE(created_at) as jour, SUM(total) as total, COUNT(*) as nb
      FROM ventes
      WHERE statut = 'COMPLETEE' AND created_at >= ${debut7j}
      GROUP BY DATE(created_at)
      ORDER BY jour ASC
    `,
    // Top 5 produits vendus ce mois
    prisma.ligneVente.groupBy({
      by: ["produitId"],
      where: { vente: { statut: "COMPLETEE", createdAt: { gte: debutMoisActuel } } },
      _sum: { quantite: true, total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    // Nb clients actifs (ont acheté ce mois)
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { statut: "COMPLETEE", createdAt: { gte: debutMoisActuel }, clientId: { not: null } },
    }),
    // Produits actifs
    prisma.produit.count({ where: { actif: true } }),
    // Factures crédit en attente de paiement
    prisma.vente.findMany({
      where: { statut: "COMPLETEE", statutPaiement: "EN_ATTENTE" },
      include: { client: { select: { nom: true, prenom: true } } },
      orderBy: { dateEcheance: "asc" },
    }),
  ]);

  // Résolution noms produits top
  const produitIds = topProduits.map((p) => p.produitId);
  const produits   = await prisma.produit.findMany({
    where: { id: { in: produitIds } },
    select: { id: true, nom: true, codeBarres: true },
  });
  const produitsMap = Object.fromEntries(produits.map((p) => [p.id, p]));

  function sum(stats: typeof statsMoisActuel, type: string) {
    return stats.find((s) => s.type === type)?._sum.montant ?? 0;
  }

  const caMois      = sum(statsMoisActuel, "RECETTE_VENTE");
  const depMois     = sum(statsMoisActuel, "DEPENSE") + sum(statsMoisActuel, "REMBOURSEMENT");
  const benefMois   = caMois - depMois;
  const caPrecedent = sum(statsMoisPrecedent, "RECETTE_VENTE");
  const caAnnee     = sum(statsAnnee, "RECETTE_VENTE");
  const depAnnee    = sum(statsAnnee, "DEPENSE") + sum(statsAnnee, "REMBOURSEMENT");
  const benefAnnee  = caAnnee - depAnnee;

  const evolutionCA = caPrecedent > 0
    ? Math.round(((caMois - caPrecedent) / caPrecedent) * 100)
    : null;

  // Jours des 7 derniers jours
  const joursLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(debut7j); d.setDate(debut7j.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const joursData = joursLabels.map((date) => {
    const found = ventesParJour.find((v) => {
      const d = new Date(v.jour);
      return d.toISOString().slice(0, 10) === date;
    });
    return { date, total: found ? Number(found.total) : 0, nb: found ? Number(found.nb) : 0 };
  });
  const maxTotal = Math.max(...joursData.map((j) => j.total), 1);

  const facturesEnRetard  = facturesEnAttente.filter((v) => v.dateEcheance && v.dateEcheance < now);
  const facturesARecevoir = facturesEnAttente.filter((v) => !v.dateEcheance || v.dateEcheance >= now);
  const totalCredit       = facturesEnAttente.reduce((s, v) => s + v.total, 0);

  return (
    <div className="space-y-6">
      {/* ── Alerte factures impayées ─────────────────────────────────────── */}
      {facturesEnAttente.length > 0 && (
        <div className={cn(
          "rounded-xl border p-4 space-y-3",
          facturesEnRetard.length > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-2">
            {facturesEnRetard.length > 0
              ? <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              : <Clock className="h-5 w-5 text-amber-600 shrink-0" />}
            <h2 className={cn("font-semibold", facturesEnRetard.length > 0 ? "text-red-700" : "text-amber-700")}>
              {facturesEnRetard.length > 0
                ? `${facturesEnRetard.length} facture${facturesEnRetard.length > 1 ? "s" : ""} en retard`
                : `${facturesEnAttente.length} facture${facturesEnAttente.length > 1 ? "s" : ""} en attente de paiement`}
              {" — "}
              <span className="font-bold">{formatCurrency(totalCredit)}</span>
            </h2>
          </div>
          <div className="space-y-1.5">
            {facturesEnAttente.map((v) => {
              const enRetard = v.dateEcheance && v.dateEcheance < now;
              return (
                <div key={v.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {enRetard && <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded px-1.5 py-0.5">EN RETARD</span>}
                    <Link href={`/ventes/${v.id}`} className="font-mono text-primary hover:underline">{v.numero}</Link>
                    {v.client && <span className="text-muted-foreground">{v.client.prenom ? `${v.client.prenom} ` : ""}{v.client.nom}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {v.dateEcheance && (
                      <span className={cn("text-xs", enRetard ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        Échéance : {formatDate(v.dateEcheance)}
                      </span>
                    )}
                    <span className="font-semibold">{formatCurrency(v.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Comptabilité</h1>
          <p className="text-sm text-muted-foreground">Vue d&apos;ensemble financière de la boutique</p>
        </div>
        <Link href="/ventes/nouvelle" className="btn-primary flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" /> Effectuer une vente
        </Link>
      </div>

      {/* KPIs mois en cours */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Recettes (mois)</span>
            <div className="rounded-lg bg-green-100 p-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(caMois)}</p>
          {evolutionCA !== null && (
            <p className={cn("text-xs mt-1 font-medium", evolutionCA >= 0 ? "text-green-600" : "text-red-500")}>
              {evolutionCA >= 0 ? "▲" : "▼"} {Math.abs(evolutionCA)}% vs mois précédent
            </p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Dépenses (mois)</span>
            <div className="rounded-lg bg-red-100 p-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(depMois)}</p>
          <p className="text-xs text-muted-foreground mt-1">Remboursements inclus</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Bénéfice net (mois)</span>
            <div className={cn("rounded-lg p-1.5", benefMois >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
              <Wallet className={cn("h-4 w-4", benefMois >= 0 ? "text-primary" : "text-destructive")} />
            </div>
          </div>
          <p className={cn("text-2xl font-bold", benefMois >= 0 ? "text-primary" : "text-destructive")}>
            {formatCurrency(benefMois)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Recettes − Dépenses</p>
        </div>
      </div>

      {/* KPIs année */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: `CA ${now.getFullYear()}`, value: formatCurrency(caAnnee), color: "text-blue-600" },
          { label: `Dépenses ${now.getFullYear()}`, value: formatCurrency(depAnnee), color: "text-orange-500" },
          { label: `Bénéfice ${now.getFullYear()}`, value: formatCurrency(benefAnnee), color: benefAnnee >= 0 ? "text-primary" : "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
            <p className={cn("text-xl font-bold", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique 7 jours */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">CA — 7 derniers jours</h2>
          </div>
          <div className="flex items-end gap-1.5 h-32">
            {joursData.map((j) => {
              const pct  = (j.total / maxTotal) * 100;
              const date = new Date(j.date + "T12:00:00");
              const label = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(date);
              return (
                <div key={j.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {j.nb > 0 ? formatCurrency(j.total) : ""}
                  </span>
                  <div className="w-full rounded-t-sm bg-primary/20 relative" style={{ height: "100px" }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-sm bg-primary transition-all"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{label}</span>
                  {j.nb > 0 && <span className="text-xs text-primary font-medium">{j.nb}v</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top produits */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Top 5 produits (mois)</h2>
            </div>
            <Link href="/produits" className="text-xs text-primary hover:underline">
              Voir tous →
            </Link>
          </div>

          {topProduits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune vente ce mois</p>
          ) : (
            <div className="space-y-3">
              {topProduits.map((tp, idx) => {
                const p       = produitsMap[tp.produitId];
                const revenu  = tp._sum.total ?? 0;
                const pctBar  = (revenu / (topProduits[0]._sum.total ?? 1)) * 100;
                return (
                  <div key={tp.produitId} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-4">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <Link href={`/produits/${tp.produitId}`}
                          className="text-sm font-medium truncate hover:text-primary transition-colors">
                          {p?.nom ?? "—"}
                        </Link>
                        <span className="text-xs font-semibold text-primary ml-2 shrink-0">
                          {formatCurrency(revenu)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pctBar}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tp._sum.quantite ?? 0} unités vendues
                        {p?.codeBarres && <span className="ml-2 font-mono">{p.codeBarres}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Liens rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/ventes",           icon: ShoppingCart, label: "Historique ventes",   sub: "Filtrer, chercher, détails" },
          { href: "/produits",         icon: Package,      label: "Gestion produits",    sub: "Stock, prix, barcodes" },
          { href: "/clients",          icon: Users,        label: "Clients",             sub: `${nbClients.length} actifs ce mois` },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="card p-4 hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-1">
              <l.icon className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{l.label}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground">{l.sub}</p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Nb produits actifs : <strong>{nbProduitsActifs}</strong>
      </p>
    </div>
  );
}
