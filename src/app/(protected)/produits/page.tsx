// ─────────────────────────────────────────────────────────────────────────────
// PAGE /produits — Liste des produits avec filtres et pagination
// Server Component — données chargées côté serveur
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { ClickableRow } from "@/components/shared/ClickableRow";

interface SearchParams {
  page?:        string;
  search?:      string;
  categorieId?: string;
  actif?:       string;
  alerte?:      string;
}

function formatPrix(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2}).format(n) + " XAF";
}

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:read")) redirect("/dashboard?error=access_denied");

  const sp         = await searchParams;
  const page       = Math.max(1, parseInt(sp.page ?? "1"));
  const limit      = 20;
  const search     = sp.search?.trim() ?? "";
  const categorieId = sp.categorieId ?? "";
  const actifFilter = sp.actif ?? "true";
  const alerteOnly  = sp.alerte === "true";

  const canCreate = hasPermission(role, "produits:create");
  const canEdit   = hasPermission(role, "produits:update");
  const canDelete = hasPermission(role, "produits:delete");

  // ── Requête produits ──────────────────────────────────────────────────────
  const where: Prisma.ProduitWhereInput = {};
  if (search) {
    where.OR = [
      { nom:         { contains: search, mode: "insensitive" } },
      { codeBarres:  { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categorieId) where.categorieId = categorieId;
  if (actifFilter === "true")  where.actif = true;
  if (actifFilter === "false") where.actif = false;

  const [produits, total, categories, alertesCount] = await Promise.all([
    prisma.produit.findMany({
      where,
      include: { categorie: true },
      orderBy: { nom: "asc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.produit.count({ where }),
    prisma.categorie.findMany({ orderBy: { nom: "asc" } }),
    // Compter les produits en alerte (stock < minimum)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM produits
      WHERE actif = true AND stock_actuel < stock_minimum
    `,
  ]);

  const produitsFiltres = alerteOnly
    ? produits.filter((p) => p.stockActuel < p.stockMinimum)
    : produits;

  const pages        = Math.ceil(total / limit);
  const nbAlertes    = Number(alertesCount[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produits &amp; Stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} produit{total > 1 ? "s" : ""}
            {nbAlertes > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                · {nbAlertes} en alerte de stock
              </span>
            )}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/produits/nouveau"
            className="relative z-10 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Nouveau produit
          </Link>
        )}
      </div>

      {/* ── Alertes de stock ────────────────────────────────────────── */}
      {nbAlertes > 0 && !alerteOnly && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <span className="text-amber-600 font-medium">
            ⚠ {nbAlertes} produit{nbAlertes > 1 ? "s" : ""} sous le seuil minimum
          </span>
          <Link
            href="/produits?alerte=true"
            className="text-amber-700 underline underline-offset-2"
          >
            Voir uniquement ces produits
          </Link>
        </div>
      )}

      {/* ── Filtres ─────────────────────────────────────────────────── */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Rechercher (nom, code-barres...)"
          className="pos-input flex-1 min-w-[200px]"
        />
        <select name="categorieId" defaultValue={categorieId} className="pos-input w-48">
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
        <select name="actif" defaultValue={actifFilter} className="pos-input w-36">
          <option value="true">Actifs</option>
          <option value="false">Archivés</option>
          <option value="">Tous</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            name="alerte"
            value="true"
            defaultChecked={alerteOnly}
            className="rounded text-indigo-600"
          />
          Alertes stock
        </label>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Filtrer
        </button>
        {(search || categorieId || actifFilter !== "true" || alerteOnly) && (
          <Link
            href="/produits"
            className="px-4 py-2 text-gray-500 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {/* ── Tableau ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th className="hidden sm:table-cell">Catégorie</th>
              <th className="text-right">Prix vente</th>
              <th className="text-right hidden md:table-cell">Prix achat</th>
              <th className="text-center hidden lg:table-cell">TVA</th>
              <th className="text-center">Stock</th>
              <th className="text-center hidden sm:table-cell">Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {produitsFiltres.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  Aucun produit trouvé
                </td>
              </tr>
            )}
            {produitsFiltres.map((produit) => {
              const enAlerte = produit.stockActuel < produit.stockMinimum;
              return (
                <ClickableRow key={produit.id} href={`/produits/${produit.id}`} className="hover:bg-gray-50">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                        {produit.imageUrl ? (
                          <Image
                            src={produit.imageUrl}
                            alt={produit.nom}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : produit.couleur ? (
                          <div className="w-full h-full" style={{ backgroundColor: produit.couleur }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">📦</div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{produit.nom}</span>
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
                  <td className="text-right text-gray-500 hidden md:table-cell">{formatPrix(produit.prixAchat)}</td>
                  <td className="text-center text-gray-500 text-sm hidden lg:table-cell">{produit.tauxTVA}%</td>
                  <td className="text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${enAlerte ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {enAlerte && "⚠ "}{produit.stockActuel}
                    </span>
                  </td>
                  <td className="text-center hidden sm:table-cell">
                    <span className={`status-badge ${produit.actif ? "status-badge-success" : "status-badge-neutral"}`}>
                      {produit.actif ? "Actif" : "Archivé"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/produits/${produit.id}`}
                        className="relative z-10 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      >
                        {canEdit ? "Modifier" : "Voir"}
                      </Link>
                      {canDelete && produit.actif && (
                        <form action={`/api/produits/${produit.id}`} method="POST">
                          <input type="hidden" name="_method" value="DELETE" />
                        </form>
                      )}
                    </div>
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} sur {pages} — {total} produits
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/produits?page=${page - 1}&search=${search}&categorieId=${categorieId}&actif=${actifFilter}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ← Précédent
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/produits?page=${page + 1}&search=${search}&categorieId=${categorieId}&actif=${actifFilter}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Suivant →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
