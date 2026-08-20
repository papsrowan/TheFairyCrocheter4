// ─────────────────────────────────────────────────────────────────────────────
// PAGE /ventes — Liste des ventes avec filtres, recherche et règlements de crédit
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Plus, Search, Receipt, TrendingUp, Clock, Banknote } from "lucide-react";
import type { Role } from "@prisma/client";
import { ClickableRow } from "@/components/shared/ClickableRow";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Ventes" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    page?:           string;
    statut?:         string;
    statutPaiement?: string;
    typeFlux?:       string; // "TOUS" | "VENTES" | "REGLEMENTS"
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
  const typeFlux       = searchParams.typeFlux;
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

  const shouldFetchVentes = typeFlux !== "REGLEMENTS";
  const shouldFetchReglements = typeFlux !== "VENTES" && !statut;

  const [ventes, totalVentes, reglementsCredit, statsAujourdhui] = await Promise.all([
    shouldFetchVentes
      ? prisma.vente.findMany({
          where,
          include: {
            client: { select: { nom: true, prenom: true } },
            vendeur: { select: { nom: true, prenom: true } },
            lignes: { select: { id: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        })
      : Promise.resolve([]),
    shouldFetchVentes ? prisma.vente.count({ where }) : Promise.resolve(0),
    shouldFetchReglements
      ? prisma.ecritureFinanciere.findMany({
          where: {
            type: "RECETTE_VENTE",
            description: { startsWith: "Règlement crédit" },
            ...(dateFilter ? { date: dateFilter } : {}),
            ...(search ? {
              OR: [
                { description: { contains: search, mode: "insensitive" as const } },
                { vente: { client: { nom: { contains: search, mode: "insensitive" as const } } } },
              ],
            } : {}),
          },
          include: {
            vente: {
              include: {
                client: { select: { nom: true, prenom: true } },
              },
            },
          },
          orderBy: { date: "desc" },
          take: pageSize,
        })
      : Promise.resolve([]),
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

  type RowItem =
    | { kind: "VENTE"; data: typeof ventes[0]; date: Date }
    | { kind: "REGLEMENT"; data: typeof reglementsCredit[0]; date: Date };

  const mergedRows: RowItem[] = [
    ...ventes.map((v) => ({ kind: "VENTE" as const, data: v, date: v.createdAt })),
    ...reglementsCredit.map((r) => ({ kind: "REGLEMENT" as const, data: r, date: r.date })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const total = totalVentes + reglementsCredit.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Conserver tous les filtres actifs dans les liens de pagination
  const lienPage = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    if (statut)         params.set("statut", statut);
    if (statutPaiement) params.set("statutPaiement", statutPaiement);
    if (typeFlux)       params.set("typeFlux", typeFlux);
    if (search)         params.set("search", search);
    if (dateDebut)      params.set("dateDebut", dateDebut);
    if (dateFin)        params.set("dateFin", dateFin);
    if (heure)          params.set("heure", heure);
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ventes &amp; Règlements</h1>
          <p className="text-muted-foreground text-sm">
            {totalVentes} vente{totalVentes > 1 ? "s" : ""}
            {reglementsCredit.length > 0 && ` · ${reglementsCredit.length} règlement(s) de crédit`}
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
        <select name="typeFlux" defaultValue={typeFlux ?? ""}
          className="h-9 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-medium">
          <option value="">Toutes opérations (Ventes + Règlements)</option>
          <option value="VENTES">Ventes uniquement</option>
          <option value="REGLEMENTS">Règlements de crédit uniquement</option>
        </select>
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
          <option value="EN_ATTENTE">En attente (Crédit / Dette)</option>
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
        {(search || statut || statutPaiement || typeFlux || dateDebut || dateFin || heure) && (
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
                <th className="px-4 py-3">Numéro / Transaction</th>
                <th className="px-4 py-3 hidden sm:table-cell">Date</th>
                <th className="px-4 py-3 hidden md:table-cell">Client</th>
                <th className="px-4 py-3 hidden lg:table-cell">Articles / Type</th>
                <th className="px-4 py-3 hidden lg:table-cell">Paiement</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut &amp; Solde</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mergedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    Aucune transaction trouvée
                  </td>
                </tr>
              ) : (
                mergedRows.map((row, idx) => {
                  if (row.kind === "REGLEMENT") {
                    const reg = row.data;
                    const meta = reg.metadata as { modePaiement?: string; reste?: number } | null;
                    const estSolde = meta?.reste !== undefined && meta.reste <= 0;
                    const vNum = reg.vente?.numero ?? "Vente";
                    const vUrl = reg.venteId ? `/ventes/${reg.venteId}` : "#";

                    return (
                      <ClickableRow key={`reg-${reg.id}-${idx}`} href={vUrl} className="bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/80 transition-colors">
                        <td className="px-4 py-3 font-mono text-sm font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                              <Banknote className="h-3 w-3" /> Règlement
                            </span>
                            <span className="text-primary font-semibold">{vNum}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">
                          {formatDateTime(reg.date)}
                        </td>
                        <td className="px-4 py-3 text-sm hidden md:table-cell">
                          {reg.vente?.client
                            ? `${reg.vente.client.prenom ?? ""} ${reg.vente.client.nom}`.trim()
                            : <span className="text-muted-foreground italic">Anonyme</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground italic hidden lg:table-cell">
                          Paiement dette
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                          {meta?.modePaiement ? (PAIEMENT_LABELS[meta.modePaiement] ?? meta.modePaiement) : "Espèces"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-green-600">+{formatCurrency(reg.montant)}</span>
                          <p className="text-[11px] text-muted-foreground">
                            {meta?.reste !== undefined
                              ? (meta.reste <= 0 ? "Reste dû: 0 XAF (Soldé)" : `Reste dû: ${formatCurrency(meta.reste)}`)
                              : "Règlement reçu"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("status-badge", estSolde ? "status-success" : "status-warning")}>
                            {estSolde ? "Crédit Soldé" : "Acompte"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {reg.venteId && (
                            <Link href={`/ventes/${reg.venteId}`} className="relative z-10 text-xs text-primary hover:underline block font-medium">
                              Voir vente →
                            </Link>
                          )}
                        </td>
                      </ClickableRow>
                    );
                  }

                  // Cas VENTE
                  const vente = row.data;
                  const statutInfo = STATUT_LABELS[vente.statut];
                  const estCredit = vente.modePaiement === "CREDIT";
                  const resteDu = Math.max(0, vente.total - (vente.montantPaye ?? 0));

                  return (
                    <ClickableRow key={`vente-${vente.id}`} href={`/ventes/${vente.id}`} className="hover:bg-muted/30 transition-colors">
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
                        {vente.lignes.length} article{vente.lignes.length > 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                        {estCredit ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Crédit
                          </span>
                        ) : (
                          PAIEMENT_LABELS[vente.modePaiement] ?? vente.modePaiement
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{formatCurrency(vente.total)}</span>
                        {estCredit && (
                          vente.statutPaiement === "PAYE" ? (
                            <p className="text-[11px] text-green-600 font-medium">Soldé (100% payé)</p>
                          ) : (
                            <p className="text-[11px] text-amber-600 font-medium">
                              Payé : {formatCurrency(vente.montantPaye ?? 0)} · Reste : {formatCurrency(resteDu)}
                            </p>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statutInfo.class}>{statutInfo.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {vente.statutPaiement === "EN_ATTENTE" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mb-1">
                            <Clock className="h-3 w-3" /> En attente
                          </span>
                        )}
                        <Link href={`/ventes/${vente.id}`} className="relative z-10 text-xs text-primary hover:underline block font-medium">
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
                  href={lienPage(page - 1)}
                  className="text-sm px-3 py-1 rounded border hover:bg-muted transition-colors"
                >
                  ← Précédent
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={lienPage(page + 1)}
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

