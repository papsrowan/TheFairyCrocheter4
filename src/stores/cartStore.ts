"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE — Caisse / Panier POS
// État de la vente en cours (produits, client, calculs)
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";

export interface CartItem {
  produitId: string;
  varianteId?: string | null;  // ID de la variante couleur sélectionnée
  nom: string;
  codeBarres?: string;
  couleur?: string | null;  // libellé couleur (affichage)
  quantite: number;
  prixBase: number;
  prixGros?: number | null;
  qtePrixGros?: number | null;
  prixGrosApplique: boolean;
  prixUnitaire: number;
  remise: number;
  tauxTVA: number;
  total: number;
}

// Clé unique par ligne panier : même produit couleurs différentes = lignes séparées
function itemKey(produitId: string, varianteId?: string | null) {
  return varianteId ? `${produitId}__${varianteId}` : produitId;
}

interface CartStore {
  items: CartItem[];
  clientId?: string;
  clientNom?: string;
  remiseGlobale: number;    // % de remise globale sur la vente
  modePaiement: "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE";
  notes: string;

  // Computed
  sousTotal: () => number;
  montantTVA: () => number;
  total: () => number;

  // Actions
  addItem: (item: Omit<CartItem, "total">) => void;
  updateQuantite: (key: string, quantite: number) => void;
  updateRemise: (key: string, remise: number) => void;
  confirmerPrixGros: (key: string) => void;
  refuserPrixGros: (key: string) => void;
  confirmerPrixGrosGroupe: (produitId: string) => void;
  refuserPrixGrosGroupe: (produitId: string) => void;
  removeItem: (key: string) => void;
  setClient: (clientId: string, clientNom: string) => void;
  clearClient: () => void;
  setRemiseGlobale: (remise: number) => void;
  setModePaiement: (mode: CartStore["modePaiement"]) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

/**
 * Calcul mixte : groupes complets au prix de gros, reste au prix normal.
 * Ex: 45 u., seuil=20, gros=700, base=1000
 *   → floor(45/20)=2 groupes × 20 × 700 = 28 000
 *   → 45 % 20 = 5 reste   × 1 000     =  5 000
 *   → total = 33 000 XAF
 */
function calculateItemTotal(
  prixBase: number,
  quantite: number,
  remise: number,
  prixGros?: number | null,
  qtePrixGros?: number | null,
  prixGrosApplique = false
): number {
  let brut: number;
  if (prixGrosApplique && prixGros && qtePrixGros && quantite >= qtePrixGros) {
    // Dès que le seuil est atteint, le prix de gros s'applique à TOUTES les unités
    brut = prixGros * quantite;
  } else {
    brut = prixBase * quantite;
  }
  return Math.round(brut * (1 - remise / 100) * 100) / 100;
}

function effectiveUnitPrice(
  prixBase: number,
  quantite: number,
  prixGros?: number | null,
  qtePrixGros?: number | null,
  prixGrosApplique = false
): number {
  if (!prixGrosApplique || !prixGros || !qtePrixGros || quantite < qtePrixGros) return prixBase;
  const total = calculateItemTotal(prixBase, quantite, 0, prixGros, qtePrixGros, true);
  return Math.round((total / quantite) * 100) / 100;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  clientId: undefined,
  clientNom: undefined,
  remiseGlobale: 0,
  modePaiement: "ESPECES",
  notes: "",

  sousTotal: () => {
    const { items, remiseGlobale } = get();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    return Math.round(subtotal * (1 - remiseGlobale / 100) * 100) / 100;
  },

  montantTVA: () => {
    const { items, remiseGlobale } = get();
    return items.reduce((sum, item) => {
      const totalHT = (item.total / (1 + item.tauxTVA / 100)) * (1 - remiseGlobale / 100);
      return sum + Math.round(totalHT * (item.tauxTVA / 100) * 100) / 100;
    }, 0);
  },

  total: () => {
    const { sousTotal } = get();
    return sousTotal();
  },

  addItem: (item) => {
    set((state) => {
      const key = itemKey(item.produitId, item.varianteId);
      const existing = state.items.find((i) => itemKey(i.produitId, i.varianteId) === key);
      if (existing) {
        const newQty = existing.quantite + item.quantite;
        const applied = existing.prixGrosApplique;
        const newPrix = effectiveUnitPrice(existing.prixBase, newQty, existing.prixGros, existing.qtePrixGros, applied);
        const newTotal = calculateItemTotal(existing.prixBase, newQty, existing.remise, existing.prixGros, existing.qtePrixGros, applied);
        return { items: state.items.map((i) => itemKey(i.produitId, i.varianteId) === key ? { ...i, quantite: newQty, prixUnitaire: newPrix, total: newTotal } : i) };
      }
      const total = calculateItemTotal(item.prixBase, item.quantite, item.remise);
      return { items: [...state.items, { ...item, prixGrosApplique: false, prixUnitaire: item.prixBase, total }] };
    });
  },

  updateQuantite: (key, quantite) => {
    if (quantite <= 0) { get().removeItem(key); return; }
    set((state) => ({
      items: state.items.map((i) => {
        if (itemKey(i.produitId, i.varianteId) !== key) return i;
        const newPrix = effectiveUnitPrice(i.prixBase, quantite, i.prixGros, i.qtePrixGros, i.prixGrosApplique);
        const newTotal = calculateItemTotal(i.prixBase, quantite, i.remise, i.prixGros, i.qtePrixGros, i.prixGrosApplique);
        return { ...i, quantite, prixUnitaire: newPrix, total: newTotal };
      }),
    }));
  },

  confirmerPrixGros: (key) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (itemKey(i.produitId, i.varianteId) !== key) return i;
        const newPrix = effectiveUnitPrice(i.prixBase, i.quantite, i.prixGros, i.qtePrixGros, true);
        const newTotal = calculateItemTotal(i.prixBase, i.quantite, i.remise, i.prixGros, i.qtePrixGros, true);
        return { ...i, prixGrosApplique: true, prixUnitaire: newPrix, total: newTotal };
      }),
    }));
  },

  refuserPrixGros: (key) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (itemKey(i.produitId, i.varianteId) !== key) return i;
        return { ...i, prixGrosApplique: false, prixUnitaire: i.prixBase, total: calculateItemTotal(i.prixBase, i.quantite, i.remise) };
      }),
    }));
  },

  updateRemise: (key, remise) => {
    set((state) => ({
      items: state.items.map((i) =>
        itemKey(i.produitId, i.varianteId) === key
          ? { ...i, remise, total: calculateItemTotal(i.prixBase, i.quantite, remise, i.prixGros, i.qtePrixGros, i.prixGrosApplique) }
          : i
      ),
    }));
  },
  // Prix de gros groupé : calcule le prix de gros sur la quantité totale de toutes les variantes du même produit, puis distribue proportionnellement par variantes
  confirmerPrixGrosGroupe: (produitId) => {
    set((state) => {
      // 1. Calculer la quantité totale de toutes les variantes
      const totalQte = state.items
        .filter((i) => i.produitId === produitId && i.prixGros && i.qtePrixGros)
        .reduce((sum, i) => sum + i.quantite, 0);

      return {
        items: state.items.map((i) => {
          if (i.produitId !== produitId || !i.prixGros || !i.qtePrixGros) return i;

          // Dès que le total (toutes couleurs) atteint le seuil, le prix de gros
          // s'applique à TOUTES les unités de chaque variante.
          if (totalQte < i.qtePrixGros) return i;
          const newTotal = Math.round(i.prixGros * i.quantite * (1 - i.remise / 100) * 100) / 100;
          return { ...i, prixGrosApplique: true, prixUnitaire: i.prixGros, total: newTotal };
        }),
      };
    });
  },

  refuserPrixGrosGroupe: (produitId) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (i.produitId !== produitId) return i;
        return { ...i, prixGrosApplique: false, prixUnitaire: i.prixBase, total: calculateItemTotal(i.prixBase, i.quantite, i.remise) };
      }),
    }));
  },

  removeItem: (key) => {
    set((state) => ({
      items: state.items.filter((i) => itemKey(i.produitId, i.varianteId) !== key),
    }));
  },

  setClient: (clientId, clientNom) => set({ clientId, clientNom }),
  clearClient: () => set({ clientId: undefined, clientNom: undefined }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: remise }),
  setModePaiement: (mode) => set({ modePaiement: mode }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      clientId: undefined,
      clientNom: undefined,
      remiseGlobale: 0,
      modePaiement: "ESPECES",
      notes: "",
    }),
}));
