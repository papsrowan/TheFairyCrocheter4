// ─────────────────────────────────────────────────────────────────────────────
// PAGE /clients — Liste des clients avec filtres, stats et pagination
// Server Component — données chargées côté serveur
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Role, Prisma } from "@prisma/client";

interface SearchParams {
  page?:   string;
  search?: string;
  tri?:    string; // "alpha" | "ventes"
}

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2}).format(n) + " XAF";
}

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:read")) redirect("/dashboard?error=access_denied");

  const sp     = await searchParams;
  const page   = Math.max(1, parseInt(sp.page ?? "1"));
  const limit  = 20;
  const search = sp.search?.trim() ?? "";
  const tri    = ["ventes", "desc", "recent"].includes(sp.tri ?? "") ? sp.tri! : "alpha";

  const canCreate = hasPermission(role, "clients:create");
  const canEdit   = hasPermission(role, "clients:update");

  // ── Filtres ──────────────────────────────────────────────────────────────
  const where: Prisma.ClientWhereInput = { anonymiseLe: null };

  if (search) {
    where.OR = [
      { nom:       { contains: search, mode: "insensitive" } },
      { prenom:    { contains: search, mode: "insensitive" } },
      { email:     { contains: search, mode: "insensitive" } },
      { telephone: { contains: search, mode: "insensitive" } },
      { ville:     { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: Prisma.ClientOrderByWithRelationInput =
    tri === "ventes" ? { ventes: { _count: "desc" } } :
    tri === "recent" ? { dernierAchat: "desc" }         :
    tri === "desc"   ? { nom: "desc" }                  :
                       { nom: "asc" };

  // ── Données ───────────────────────────────────────────────────────────────
  const [clients, total, stats] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        categorie: true,
        _count: { select: { ventes: true } },
      },
      orderBy,
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.client.count({ where }),
    // Stats rapides
    Promise.all([
      prisma.client.count({ where: { anonymiseLe: null } }),
      prisma.$queryRaw<[{ total: number | null }]>`
        SELECT SUM(total_achats)::float AS total FROM clients WHERE anonymise_le IS NULL
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM clients
        WHERE anonymise_le IS NULL
          AND dernier_achat >= NOW() - INTERVAL '30 days'
      `,
    ]),
  ]);

  const [nbTotal, caResult, actifsResult] = stats;
  const caTotal  = caResult[0]?.total ?? 0;
  const nbActifs = Number(actifsResult[0]?.count ?? 0);
  const pages    = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {nbTotal} client{nbTotal > 1 ? "s" : ""} enregistré{nbTotal > 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/clients/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + Nouveau client
          </Link>
        )}
      </div>

      {/* ── Stats rapides ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total clients</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{nbTotal}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Actifs (30 jours)</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{nbActifs}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">CA total clients</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatMontant(caTotal)}</p>
        </div>
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────── */}
      <form method="GET" className="flex flex-wrap gap-3">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Rechercher (nom, numéro, email, téléphone...)"
          className="pos-input flex-1 min-w-[200px]"
        />
        <select name="tri" defaultValue={tri} className="pos-input w-56">
          <option value="alpha">A → Z (croissant)</option>
          <option value="desc">Z → A (décroissant)</option>
          <option value="recent">Activité la plus récente</option>
          <option value="ventes">Plus de ventes</option>
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Filtrer
        </button>
        {(search || tri !== "alpha") && (

          <Link
            href="/clients"
            className="px-4 py-2 text-gray-500 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {/* ── Tableau ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th className="hidden sm:table-cell">Contact</th>
              <th className="hidden md:table-cell">Catégorie</th>
              <th className="text-right">Total achats</th>
              <th className="hidden sm:table-cell">Dernier achat</th>
              <th className="text-center hidden lg:table-cell">Ventes</th>
              <th className="text-center hidden lg:table-cell">RGPD</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  Aucun client trouvé
                </td>
              </tr>
            )}
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td>
                  <div className="font-medium text-gray-900">
                    {client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
                  </div>
                  {client.ville && (
                    <div className="text-xs text-gray-400">{client.ville}</div>
                  )}
                </td>
                <td className="hidden sm:table-cell">
                  <div className="text-sm text-gray-700">{client.email ?? "—"}</div>
                  <div className="text-xs text-gray-400">{client.telephone ?? ""}</div>
                </td>
                <td className="hidden md:table-cell">
                  {client.categorie ? (
                    <span className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                      {client.categorie.nom}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
                <td className="text-right font-medium text-gray-900">
                  {formatMontant(client.totalAchats)}
                </td>
                <td className="text-sm text-gray-500 hidden sm:table-cell">
                  {formatDate(client.dernierAchat)}
                </td>
                <td className="text-center hidden lg:table-cell">
                  <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {client._count.ventes}
                  </span>
                </td>
                <td className="text-center hidden lg:table-cell">
                  <span className={`inline-flex w-2 h-2 rounded-full ${client.consentementRGPD ? "bg-green-500" : "bg-gray-300"}`}
                    title={client.consentementRGPD ? "Consentement donné" : "Non"} />
                </td>
                <td>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    {canEdit ? "Modifier" : "Voir"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} sur {pages} — {total} client{total > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/clients?page=${page - 1}&search=${search}&tri=${tri}`}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                ← Précédent
              </Link>
            )}
            {page < pages && (
              <Link
                href={`/clients?page=${page + 1}&search=${search}&tri=${tri}`}
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
