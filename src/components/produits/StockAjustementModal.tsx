"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT StockAjustementModal — Ajustement manuel du stock
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

interface StockAjustementModalProps {
  produitId:   string;
  produitNom:  string;
  stockActuel: number;
  onSuccess:   (nouveauStock: number) => void;
  onClose:     () => void;
}

const TYPES = [
  { value: "ENTREE",          label: "Entrée de stock",   desc: "Réception marchandise, retour fournisseur" },
  { value: "SORTIE_MANUELLE", label: "Sortie manuelle",   desc: "Perte, casse, don..." },
  { value: "CORRECTION",      label: "Correction",        desc: "Erreur de saisie à corriger" },
  { value: "INVENTAIRE",      label: "Inventaire",        desc: "Mise à jour du stock réel compté" },
] as const;

type TypeMouvement = typeof TYPES[number]["value"];

export default function StockAjustementModal({
  produitId, produitNom, stockActuel, onSuccess, onClose,
}: StockAjustementModalProps) {
  const [type, setType]         = useState<TypeMouvement>("ENTREE");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const quantiteNum = parseInt(quantite) || 0;

  function calculeStockPrevu(): number | null {
    if (!quantite) return null;
    switch (type) {
      case "ENTREE":          return stockActuel + quantiteNum;
      case "SORTIE_MANUELLE": return stockActuel - quantiteNum;
      case "CORRECTION":      return stockActuel + quantiteNum;
      case "INVENTAIRE":      return quantiteNum;
    }
  }

  const stockPrevu = calculeStockPrevu();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = { type, quantite: quantiteNum, motif: motif || undefined };
    if (type === "INVENTAIRE") payload.nouveauStock = quantiteNum;

    try {
      const res = await fetch(`/api/produits/${produitId}/stock`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erreur serveur");
      }
      const data = await res.json();
      onSuccess(data.stockActuel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">Ajuster le stock</h2>
            <p className="text-sm text-gray-500 truncate max-w-[220px]">{produitNom}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Stock actuel */}
          <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-xl">
            <span className="text-sm text-muted-foreground">Stock actuel</span>
            <span className="text-2xl font-bold text-foreground">{stockActuel}</span>
          </div>

          {/* Type de mouvement */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de mouvement</label>
            <div className="space-y-2">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    type === t.value
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => { setType(t.value); setQuantite(""); }}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === "INVENTAIRE" ? "Stock réel compté" : "Quantité"}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="number"
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              required
              min={type === "CORRECTION" ? undefined : "1"}
              step="1"
              placeholder={type === "INVENTAIRE" ? "Stock total compté" : "Quantité"}
              className="pos-input w-full"
              autoFocus
            />
          </div>

          {/* Aperçu du stock prévu */}
          {stockPrevu !== null && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${
              stockPrevu < 0
                ? "bg-red-50 border border-red-200"
                : "bg-green-50 border border-green-200"
            }`}>
              <span className="text-sm text-gray-600">Stock après ajustement</span>
              <span className={`text-xl font-bold ${stockPrevu < 0 ? "text-red-600" : "text-green-700"}`}>
                {stockPrevu < 0 ? "⚠ " : ""}{stockPrevu}
              </span>
            </div>
          )}

          {/* Motif */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={500}
              placeholder="Ex: Réception commande fournisseur #42"
              className="pos-input w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary py-3 text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !quantite || (stockPrevu !== null && stockPrevu < 0)}
              className="flex-1 btn-primary py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Enregistrement..." : "Valider"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
