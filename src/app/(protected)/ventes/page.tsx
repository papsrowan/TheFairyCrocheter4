// ─────────────────────────────────────────────────────────────────────────────
// PAGE /ventes — Liste des ventes avec filtres et recherche
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Plus, Search, Receipt, TrendingUp } from "lucide-react";
import type { Role } from "@prisma/client";
import { ClickableRow } from "@/components/shared/ClickableRow";

export const metadata: Metadata = { title: "Ventes" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?:           string;
    statut?:         string;
    statutPaiement?: string;
    search?:         string;
    dateDebut?:      string;
    dateFin?:        string;
    heure?:          string;
  };
}

const STATUT_LABELS = {
  COMPLETEE: { label: "Complétée", class: "status-badge status-success" },
  ANNULEE: { label: "Annulée", class: "status-badge status-error" },
  REMBOURSEE: { label: "Remboursée", class: "status-badge status-warning" },
} as const;

const PAIEMENT_LABELS: Record<string, string> = {
  ESPECES:  "Espèces",
  CARTE:    "Carte",
  VIREMENT: "Virement",
  CHEQUE:   "Chèque",
  MIXTE:    "Mixte",
  CREDIT:   "Crédit",
};

export default async function VentesPage({ searchParams }: PageProps) {
  const session = await auth();
  const canCreate = hasPermission(session!.user.role as Role, "ventes:create");

  const page           = Math.max(1, parseInt(searchParams.page ?? "1"));
  const pageSize       = 20;
  const statut         = searchParams.statut as "COMPLETEE" | "ANNULEE" | "REMBOURSEE" | undefined;
  const statutPaiement = searchParams.statutPaiement as "PAYE" | "EN_ATTENTE" | undefined;
  const search         = searchParams.search;
  const dateDebut      = searchParams.dateDebut;
  const dateFin        = searchParams.dateFin;
  const heure          = searchParams.heure; // format "HH" ex: "09"

  // Construction du filtre date/heure
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (dateDebut || dateFin || heure) {
    const gte = dateDebut ? new Date(`${dateDebut}T00:00:00`) : undefined;
    const lte = dateFin   ? new Date(`${dateFin}T23:59:59`)   : undefined;
    if (heure) {
      const h = parseInt(heure);
      const base = dateDebut ? new Date(dateDebut) : new Date();
      base.setHours(h, 0, 0, 0);
      const end  = new Date(base); end.setHours(h, 59, 59, 999);
      dateFilter = { gte: base, lte: end };
    } else {
      dateFilter = { ...(gte && { gte }), ...(lte && { lte }) };
    }
  }

  const where = {
    ...(statut         && { statut }),
    ...(statutPaiement && { statutPaiement }),
    ...(dateFilter     && { createdAt: dateFilter }),
    ...(search && {
      OR: [
        { numero: { contains: search, mode: "insensitive" as const } },
        { client: { nom: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [ventes, total, statsAujourdhui] = await Promise.all([
    prisma.vente.findMany({
      where,
      include: {
        client: { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
        lignes: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vente.count({ where }),
    // Stats du jour
    prisma.vente.aggregate({
      where: {
        statut: "COMPLETEE",
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventes</h1>
          <p className="text-muted-foreground text-sm">
            {total} vente{total > 1 ? "s" : ""} au total
          </p>
        </div>
        {canCreate && (
          <Link
            href="/ventes/nouvelle"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/25 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Scanner / Nouvelle vente</span>
            <span className="sm:hidden">Scanner</span>
          </Link>
        )}
      </div>

      {/* Stats rapides du jour */}
      <div className="grid grid-cols-2 gap-4">
        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
              <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ventes aujourd&apos;hui</p>
              <p className="text-2xl font-bold">{statsAujourdhui._count}</p>
            </div>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">CA aujourd&apos;hui</p>
              <p className="text-2xl font-bold">
                {formatCurrency(statsAujourdhui._sum.total ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <form className="flex flex-wrap gap-2 items-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input name="search" defaultValue={search ?? ""}
            placeholder="Numéro ou client..."
            className="h-9 rounded-md border bg-background pl-8 pr-3 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <select name="statut" defaultValue={statut ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tous statuts</option>
          <option value="COMPLETEE">Complétée</option>
          <option value="ANNULEE">Annulée</option>
          <option value="REMBOURSEE">Remboursée</option>
        </select>
        <select name="statutPaiement" defaultValue={statutPaiement ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Tout paiement</option>
          <option value="PAYE">Payé</option>
          <option value="EN_ATTENTE">En attente</option>
        </select>
        <input type="date" name="dateDebut" defaultValue={dateDebut ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <input type="date" name="dateFin" defaultValue={dateFin ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <select name="heure" defaultValue={heure ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Toute heure</option>
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={String(i).padStart(2, "0")}>
              {String(i).padStart(2, "0")}h00 – {String(i).padStart(2, "0")}h59
            </option>
          ))}
        </select>
        <button type="submit"
          className="h-9 rounded-md bg-primary text-primary-foreground px-3 text-sm font-medium hover:bg-primary/90 transition-colors">
          Filtrer
        </button>
        {(search || statut || statutPaiement || dateDebut || dateFin || heure) && (
          <a href="/ventes" className="h-9 flex items-center px-3 rounded-md border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Réinitialiser
          </a>
        )}
      </form>

      {/* Tableau */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 hidden md:table-cell">Client</th>
                <th className="px-4 py-3 hidden lg:table-cell">Articles</th>
                <th className="px-4 py-3 hidden lg:table-cell">Paiement</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ventes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Aucune vente trouvée
                  </td>
                </tr>
              ) : (
                ventes.map((vente) => {
                  const statutInfo = STATUT_LABELS[vente.statut];
                  return (
                    <ClickableRow key={vente.id} href={`/ventes/${vente.id}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-medium text-primary">
                        {vente.numero}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                        {formatDateTime(vente.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm hidden md:table-cell">
                        {vente.client
                          ? `${vente.client.prenom ?? ""} ${vente.client.nom}`.trim()
                          : <span className="text-muted-foreground italic">Anonyme</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center hidden lg:table-cell">
                        {vente.lignes.length}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {PAIEMENT_LABELS[vente.modePaiement]}
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(vente.total)}</td>
                      <td className="px-4 py-3">
                        <span className={statutInfo.class}>{statutInfo.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {vente.statutPaiement === "EN_ATTENTE" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mb-1">
                            ⏳ En attente
                          </span>
                        )}
                        <Link href={`/ventes/${vente.id}`} className="relative z-10 text-xs text-primary hover:underline block">
                          Voir →
                        </Link>
                      </td>
                    </ClickableRow>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} · {total} résultats
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}&statut=${statut ?? ""}&search=${search ?? ""}`}
                  className="text-sm px-3 py-1 rounded border hover:bg-muted transition-colors"
                >
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?page=${page + 1}&statut=${statut ?? ""}&search=${search ?? ""}`}
                  className="text-sm px-3 py-1 rounded border hover:bg-muted transition-colors"
                >
                  Suivant →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
