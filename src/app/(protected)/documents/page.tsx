import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/security/rbac";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { FileText, Receipt, Download } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = {
  ESPECES:  "Espèces",
  CARTE:    "Carte",
  VIREMENT: "Virement",
  CHEQUE:   "Chèque",
  MIXTE:    "Mixte",
  CREDIT:   "Crédit",
};

interface PageProps {
  searchParams: { page?: string; search?: string; dateDebut?: string; dateFin?: string };
}

export default async function DocumentsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!hasPermission(session!.user.role as Role, "documents:read")) redirect("/dashboard");

  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const pageSize = 20;
  const search = searchParams.search?.trim();
  const dateDebut = searchParams.dateDebut;
  const dateFin = searchParams.dateFin;

  const where = {
    statut: "COMPLETEE" as const,
    ...((dateDebut || dateFin) && {
      createdAt: {
        ...(dateDebut && { gte: new Date(dateDebut) }),
        ...(dateFin && { lte: new Date(dateFin + "T23:59:59Z") }),
      },
    }),
    ...(search && {
      OR: [
        { numero: { contains: search, mode: "insensitive" as const } },
        { client: { nom: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [ventes, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        client: { select: { nom: true, prenom: true } },
        _count: { select: { lignes: true } },
      },
    }),
    prisma.vente.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground">Factures et reçus des ventes</p>
      </div>

      {/* Filtres */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Recherche</label>
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="N° vente ou client..."
            className="form-input w-52"
          />
        </div>
        <div>
          <label className="form-label">Du</label>
          <input type="date" name="dateDebut" defaultValue={dateDebut ?? ""} className="form-input" />
        </div>
        <div>
          <label className="form-label">Au</label>
          <input type="date" name="dateFin" defaultValue={dateFin ?? ""} className="form-input" />
        </div>
        <button type="submit" className="btn-primary">Filtrer</button>
        {(search || dateDebut || dateFin) && (
          <a href="/documents" className="btn-ghost">Réinitialiser</a>
        )}
      </form>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-3 font-medium">N° Vente</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Paiement</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
              <th className="text-center px-4 py-3 font-medium">Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ventes.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Aucun document trouvé
                </td>
              </tr>
            )}
            {ventes.map((v) => (
              <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-primary">{v.numero}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDateTime(v.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {v.client
                    ? `${v.client.nom}${v.client.prenom ? " " + v.client.prenom : ""}`
                    : <span className="text-muted-foreground italic">Client comptoir</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {MODE_LABELS[v.modePaiement] ?? v.modePaiement}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(v.total)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <a
                      href={`/api/documents/facture/${v.id}`}
                      title="Télécharger la facture PDF"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200",
                        "transition-colors"
                      )}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span>Facture PDF</span>
                    </a>
                    <a
                      href={`/documents/recu/${v.id}`}
                      title="Voir le reçu"
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
                        "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200",
                        "transition-colors"
                      )}
                    >
                      <Receipt className="h-3.5 w-3.5 shrink-0" />
                      <span>Reçu</span>
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {total} vente{total > 1 ? "s" : ""} — page {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`?page=${page - 1}&${new URLSearchParams({ ...(search && { search }), ...(dateDebut && { dateDebut }), ...(dateFin && { dateFin }) }).toString()}`}
                className="btn-ghost"
              >
                ← Précédent
              </a>
            )}
            {page < totalPages && (
              <a
                href={`?page=${page + 1}&${new URLSearchParams({ ...(search && { search }), ...(dateDebut && { dateDebut }), ...(dateFin && { dateFin }) }).toString()}`}
                className="btn-primary"
              >
                Suivant →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
