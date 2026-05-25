"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StockAjustementModal from "./StockAjustementModal";

interface ProduitDetailClientProps {
  produitId:    string;
  produitNom:   string;
  stockActuel:  number;
  stockMinimum: number;
  actif:        boolean;
  canStock:     boolean;
  canDelete:    boolean;
  isSuperAdmin: boolean;
}

export default function ProduitDetailClient({
  produitId, produitNom, stockActuel, stockMinimum, actif, canStock, canDelete, isSuperAdmin,
}: ProduitDetailClientProps) {
  const router = useRouter();
  const [showModal, setShowModal]     = useState(false);
  const [currentStock, setCurrentStock] = useState(stockActuel);
  const [archiving, setArchiving]     = useState(false);
  const [purging, setPurging]         = useState(false);

  const enAlerte = currentStock < stockMinimum;

  function handleStockSuccess(nouveauStock: number) {
    setCurrentStock(nouveauStock);
    setShowModal(false);
    router.refresh();
  }

  async function handleArchiver() {
    if (!confirm(`Archiver "${produitNom}" ? Il ne sera plus visible dans la caisse. L'historique est conservé.`)) return;
    setArchiving(true);
    try {
      await fetch(`/api/produits/${produitId}?action=archive`, { method: "DELETE" });
      router.push("/produits");
      router.refresh();
    } finally {
      setArchiving(false);
    }
  }

  async function handleSupprimer() {
    const confirm1 = confirm(
      `⚠️ SUPPRESSION DÉFINITIVE\n\nSupprimer "${produitNom}" effacera toutes ses données (stock, mouvements, variantes).\n\nCette action est IRRÉVERSIBLE.\n\nContinuer ?`
    );
    if (!confirm1) return;
    const confirm2 = confirm(`Dernière confirmation : supprimer définitivement "${produitNom}" ?`);
    if (!confirm2) return;

    setPurging(true);
    try {
      const res = await fetch(`/api/produits/${produitId}?action=purge`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Erreur lors de la suppression");
        return;
      }
      router.push("/produits");
      router.refresh();
    } finally {
      setPurging(false);
    }
  }

  return (
    <>
      {/* Stock */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Stock</h3>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Stock actuel</span>
            <span className={`font-bold text-lg ${enAlerte ? "text-red-600" : "text-gray-900"}`}>
              {currentStock}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                enAlerte ? "bg-red-400" : currentStock > stockMinimum * 2 ? "bg-green-400" : "bg-amber-400"
              }`}
              style={{ width: `${Math.min(100, (currentStock / (stockMinimum * 3 || 1)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>Seuil : {stockMinimum}</span>
          </div>
        </div>

        {enAlerte && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            ⚠ Stock sous le seuil minimum ({stockMinimum})
          </div>
        )}

        {canStock && actif && (
          <button
            onClick={() => setShowModal(true)}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Ajuster le stock
          </button>
        )}
      </div>

      {/* Zone danger */}
      {canDelete && (
        <div className="bg-white rounded-xl border border-red-100 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">Zone danger</h3>

          {actif && (
            <>
              <p className="text-xs text-gray-500">
                Archiver masque le produit de la caisse et des recherches. L&apos;historique des ventes et rapports est conservé.
              </p>
              <button
                onClick={handleArchiver}
                disabled={archiving}
                className="w-full px-4 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
              >
                {archiving ? "Archivage..." : "📦 Archiver le produit"}
              </button>
            </>
          )}

          {isSuperAdmin && (
            <>
              <div className="border-t border-red-100 pt-3">
                <p className="text-xs text-red-600 font-medium mb-1">Super Admin uniquement</p>
                <p className="text-xs text-gray-500 mb-3">
                  Supprime définitivement le produit, ses variantes et ses mouvements de stock.
                  Impossible si des ventes existent pour ce produit.
                </p>
                <button
                  onClick={handleSupprimer}
                  disabled={purging}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {purging ? "Suppression..." : "🗑️ Supprimer définitivement"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showModal && (
        <StockAjustementModal
          produitId={produitId}
          produitNom={produitNom}
          stockActuel={currentStock}
          onSuccess={handleStockSuccess}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
