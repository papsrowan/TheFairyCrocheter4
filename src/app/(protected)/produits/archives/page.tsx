// ─────────────────────────────────────────────────────────────────────────────
// PAGE /produits/archives — Produits archivés + désarchivage
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { DesarchiverButton } from "./DesarchiverButton";

export const metadata: Metadata = { title: "Produits archivés" };
export const dynamic = "force-dynamic";

function formatPrix(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " XAF";
}

export default async function ProduitsArchivesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:read")) redirect("/dashboard?error=access_denied");

  const canRestore = hasPermission(role, "produits:update");

  const produits = await prisma.produit.findMany({
    where: { actif: false },
    include: { categorie: true },
    orderBy: { deletedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits archivés</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {produits.length} produit{produits.length > 1 ? "s" : ""} archivé{produits.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/produits"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          ← Retour aux produits
        </Link>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th className="hidden sm:table-cell">Catégorie</th>
                <th className="text-right">Prix vente</th>
                <th className="text-center">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {produits.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    Aucun produit archivé
                  </td>
                </tr>
              )}
              {produits.map((produit) => (
                <tr key={produit.id} className="hover:bg-gray-50">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                        {produit.imageUrl ? (
                          <Image src={produit.imageUrl} alt={produit.nom} fill className="object-cover" sizes="40px" />
                        ) : produit.couleur ? (
                          <div className="w-full h-full" style={{ backgroundColor: produit.couleur }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">📦</div>
                        )}
                      </div>
                      <div>
                        <Link href={`/produits/${produit.id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                          {produit.nom}
                        </Link>
                        {produit.codeBarres && (
                          <div className="text-xs text-gray-400 font-mono">{produit.codeBarres}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell">
                    {produit.categorie ? (
                      <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {produit.categorie.nom}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="text-right font-medium">{formatPrix(produit.prixVente)}</td>
                  <td className="text-center">{produit.stockActuel}</td>
                  <td>
                    <div className="flex items-center justify-end">
                      {canRestore && (
                        <DesarchiverButton produitId={produit.id} produitNom={produit.nom} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
