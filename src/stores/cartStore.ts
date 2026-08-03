"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE — Caisse / Panier POS
// Prix dégressifs automatiques : le prix unitaire s'ajuste selon la quantité
// via les paliers du produit (aucune confirmation manuelle).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { prixUnitairePourQuantite, type Palier } from "@/lib/utils/prix";

export interface CartItem {
  produitId: string;
  varianteId?: string | null;  // ID de la variante couleur sélectionnée
  nom: string;
  codeBarres?: string;
  couleur?: string | null;  // libellé couleur (affichage)
  quantite: number;
  prixBase: number;          // prix détail (unité)
  paliers?: Palier[];        // paliers de prix dégressifs
  prixUnitaire: number;      // prix unitaire effectif (selon quantité)
  remise: number;
  tauxTVA: number;
  total: number;
  // Champs conservés pour compat (non utilisés dans le calcul)
  prixGros?: number | null;
  qtePrixGros?: number | null;
  prixGrosApplique?: boolean;
}

function itemKey(produitId: string, varianteId?: string | null) {
  return varianteId ? `${produitId}__${varianteId}` : produitId;
}

interface CartStore {
  items: CartItem[];
  clientId?: string;
  clientNom?: string;
  remiseGlobale: number;
  modePaiement: "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE";
  notes: string;

  sousTotal: () => number;
  montantTVA: () => number;
  total: () => number;

  addItem: (item: Omit<CartItem, "total" | "prixUnitaire"> & { prixUnitaire?: number }) => void;
  updateQuantite: (key: string, quantite: number) => void;
  updateRemise: (key: string, remise: number) => void;
  removeItem: (key: string) => void;
  setClient: (clientId: string, clientNom: string) => void;
  clearClient: () => void;
  setRemiseGlobale: (remise: number) => void;
  setModePaiement: (mode: CartStore["modePaiement"]) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

/** Prix unitaire effectif (palier atteint selon la quantité). */
function prixEffectif(prixBase: number, paliers: Palier[] | undefined, quantite: number): number {
  return prixUnitairePourQuantite(prixBase, paliers, quantite);
}

/** Total ligne = prix unitaire (selon paliers) × quantité, remise appliquée. */
function calcTotal(prixBase: number, paliers: Palier[] | undefined, quantite: number, remise: number): number {
  const pu = prixEffectif(prixBase, paliers, quantite);
  return Math.round(pu * quantite * (1 - remise / 100) * 100) / 100;
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

  total: () => get().sousTotal(),

  addItem: (item) => {
    set((state) => {
      const key = itemKey(item.produitId, item.varianteId);
      const existing = state.items.find((i) => itemKey(i.produitId, i.varianteId) === key);
      if (existing) {
        const newQty = existing.quantite + item.quantite;
        return {
          items: state.items.map((i) =>
            itemKey(i.produitId, i.varianteId) === key
              ? { ...i, quantite: newQty, prixUnitaire: prixEffectif(i.prixBase, i.paliers, newQty), total: calcTotal(i.prixBase, i.paliers, newQty, i.remise) }
              : i
          ),
        };
      }
      const prixUnitaire = prixEffectif(item.prixBase, item.paliers, item.quantite);
      const total = calcTotal(item.prixBase, item.paliers, item.quantite, item.remise);
      return { items: [...state.items, { ...item, prixGrosApplique: false, prixUnitaire, total }] };
    });
  },

  updateQuantite: (key, quantite) => {
    if (quantite <= 0) { get().removeItem(key); return; }
    set((state) => ({
      items: state.items.map((i) => {
        if (itemKey(i.produitId, i.varianteId) !== key) return i;
        return { ...i, quantite, prixUnitaire: prixEffectif(i.prixBase, i.paliers, quantite), total: calcTotal(i.prixBase, i.paliers, quantite, i.remise) };
      }),
    }));
  },

  updateRemise: (key, remise) => {
    set((state) => ({
      items: state.items.map((i) =>
        itemKey(i.produitId, i.varianteId) === key
          ? { ...i, remise, total: calcTotal(i.prixBase, i.paliers, i.quantite, remise) }
          : i
      ),
    }));
  },

  removeItem: (key) => {
    set((state) => ({ items: state.items.filter((i) => itemKey(i.produitId, i.varianteId) !== key) }));
  },

  setClient: (clientId, clientNom) => set({ clientId, clientNom }),
  clearClient: () => set({ clientId: undefined, clientNom: undefined }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: remise }),
  setModePaiement: (mode) => set({ modePaiement: mode }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({ items: [], clientId: undefined, clientNom: undefined, remiseGlobale: 0, modePaiement: "ESPECES", notes: "" }),
}));
