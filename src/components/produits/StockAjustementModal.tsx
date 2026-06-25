"use client";

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT StockAjustementModal — Ajustement manuel du stock
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

interface VarianteOpt { id: string; couleur: string; description?: string | null; stockActuel: number }

interface StockAjustementModalProps {
  produitId:   string;
  produitNom:  string;
  stockActuel: number;
  variantes?:  VarianteOpt[];
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
  produitId, produitNom, stockActuel, variantes = [], onSuccess, onClose,
}: StockAjustementModalProps) {
  const [type, setType]         = useState<TypeMouvement>("ENTREE");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const hasVariantes            = variantes.length > 0;
  const [varianteId, setVarianteId] = useState<string>(hasVariantes ? variantes[0].id : "");

  const quantiteNum = parseInt(quantite) || 0;
  // Base de calcul : stock de la couleur choisie (sinon stock global)
  const varianteSel = variantes.find((v) => v.id === varianteId) ?? null;
  const baseStock   = hasVariantes ? (varianteSel?.stockActuel ?? 0) : stockActuel;

  function calculeStockPrevu(): number | null {
    if (!quantite) return null;
    switch (type) {
      case "ENTREE":          return baseStock + quantiteNum;
      case "SORTIE_MANUELLE": return baseStock - quantiteNum;
      case "CORRECTION":      return baseStock + quantiteNum;
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
    if (hasVariantes) payload.varianteId = varianteId;

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

          {/* Sélecteur de couleur (produits multi-couleur) */}
          {hasVariantes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Couleur à ajuster</label>
              <div className="flex flex-wrap gap-2">
                {variantes.map((v) => {
                  const sel = v.id === varianteId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => { setVarianteId(v.id); setQuantite(""); }}
                      title={`${v.couleur}${v.description ? " — " + v.description : ""} — ${v.stockActuel} en stock`}
                      className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs transition-all ${
                        sel ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: v.couleur }} />
                      <span className="font-medium">{v.couleur}</span>
                      <span className="text-gray-400">({v.stockActuel})</span>
                    </button>
                  );
                })}
              </div>
              {varianteSel?.description && (
                <p className="text-xs text-gray-500 mt-1">{varianteSel.description}</p>
              )}
            </div>
          )}

          {/* Stock actuel (de la couleur choisie si applicable) */}
          <div className="flex items-center justify-between px-4 py-3 bg-secondary rounded-xl">
            <span className="text-sm text-muted-foreground">
              {hasVariantes ? `Stock ${varianteSel?.couleur ?? ""}` : "Stock actuel"}
            </span>
            <span className="text-2xl font-bold text-foreground">{baseStock}</span>
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
