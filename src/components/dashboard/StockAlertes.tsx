"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT StockAlertes — Liste des produits en dessous du stock minimum
// Mis à jour en temps réel par les événements SSE stock.alerte / stock.updated
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";

interface ProduitAlerte {
  id:           string;
  nom:          string;
  stockActuel:  number;
  stockMinimum: number;
  categorie:    { nom: string } | null;
}

interface Props {
  alertes: ProduitAlerte[];
}

export function StockAlertes({ alertes }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">Alertes stock</h2>
          {alertes.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
              {alertes.length}
            </span>
          )}
        </div>
        <Link
          href="/produits?alerte=true"
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Voir tous →
        </Link>
      </div>

      {alertes.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-2xl mb-1">✓</p>
          <p className="text-sm text-gray-500">Tous les stocks sont suffisants</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {alertes.slice(0, 8).map((produit) => {
            const ratio   = produit.stockMinimum > 0 ? produit.stockActuel / produit.stockMinimum : 0;
            const urgence = produit.stockActuel === 0 ? "danger" : ratio < 0.5 ? "warning" : "low";

            const barColor: Record<string, string> = {
              danger:  "bg-red-500",
              warning: "bg-amber-400",
              low:     "bg-yellow-300",
            };

            return (
              <li key={produit.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/produits/${produit.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate"
                      >
                        {produit.nom}
                      </Link>
                      {produit.categorie && (
                        <span className="shrink-0 text-xs text-gray-400">
                          {produit.categorie.nom}
                        </span>
                      )}
                    </div>
                    {/* Barre de stock */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor[urgence]}`}
                          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                        {produit.stockActuel} / {produit.stockMinimum}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      produit.stockActuel === 0
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {produit.stockActuel === 0 ? "Rupture" : `${produit.stockActuel} unités`}
                  </span>
                </div>
              </li>
            );
          })}
          {alertes.length > 8 && (
            <li className="px-5 py-3 text-center">
              <Link href="/produits?alerte=true" className="text-xs text-indigo-600 hover:text-indigo-800">
                + {alertes.length - 8} autres produits en alerte
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
