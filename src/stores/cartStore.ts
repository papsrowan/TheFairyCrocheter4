"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE — Caisse / Panier POS
// Prix dégressifs : le prix unitaire s'ajuste selon la quantité totale du 
// produit dans le panier (toutes variantes confondues), avec confirmation manuelle.
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
  // Ajout pour gestion UI du palier
  palierDisponible?: boolean;
  prixPossibleAvecPalier?: number;
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
  paliersAccepte: Record<string, boolean>; // mémorise si le palier a été accepté pour un produitId
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
  repondrePalier: (produitId: string, accepte: boolean) => void;
  setClient: (clientId: string, clientNom: string) => void;
  clearClient: () => void;
  setRemiseGlobale: (remise: number) => void;
  setModePaiement: (mode: CartStore["modePaiement"]) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;
}

/** 
 * Recalcule tout le panier en groupant les quantités par produitId 
 * pour vérifier les paliers de prix. Demande confirmation si un palier est atteint.
 */
function recalculateCart(
  items: CartItem[], 
  paliersAccepte: Record<string, boolean>
): { items: CartItem[]; paliersAccepte: Record<string, boolean> } {
  const newPaliersAccepte = { ...paliersAccepte };

  // 1. Calcul de la quantité totale par produitId
  const qteParProduit = new Map<string, number>();
  for (const item of items) {
    qteParProduit.set(item.produitId, (qteParProduit.get(item.produitId) || 0) + item.quantite);
  }

  // 2. Mise à jour des prix de chaque item
  const newItems = items.map(item => {
    const totalQte = qteParProduit.get(item.produitId) || 0;
    
    // Le prix théorique si on applique le palier avec la quantité totale
    const prixAvecPalier = prixUnitairePourQuantite(item.prixBase, item.paliers, totalQte);
    
    // Le palier est-il atteint ?
    const palierAtteint = prixAvecPalier < item.prixBase;
    let applyPalier = false;
    let palierDisponible = false;

    if (palierAtteint) {
      if (newPaliersAccepte[item.produitId] === undefined) {
        // En attente d'une réponse de l'UI
        palierDisponible = true;
      } else {
        applyPalier = newPaliersAccepte[item.produitId];
      }
    } else {
      // Si on retombe sous le palier, on efface le choix pour pouvoir redemander plus tard
      if (newPaliersAccepte[item.produitId] !== undefined) {
        delete newPaliersAccepte[item.produitId];
      }
    }

    const prixUnitaire = applyPalier ? prixAvecPalier : item.prixBase;
    const totalBrut = prixUnitaire * item.quantite;
    const total = Math.max(0, totalBrut - item.remise);

    return {
      ...item,
      prixUnitaire,
      total,
      palierDisponible,
      prixPossibleAvecPalier: prixAvecPalier
    };
  });

  return { items: newItems, paliersAccepte: newPaliersAccepte };
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  paliersAccepte: {},
  clientId: undefined,
  clientNom: undefined,
  remiseGlobale: 0,
  modePaiement: "ESPECES",
  notes: "",

  sousTotal: () => {
    const { items, remiseGlobale } = get();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    return Math.max(0, subtotal - remiseGlobale);
  },

  montantTVA: () => {
    const { items, remiseGlobale } = get();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const ratioGlobale = subtotal > 0 ? Math.max(0, subtotal - remiseGlobale) / subtotal : 0;
    
    return items.reduce((sum, item) => {
      const totalHT = item.total / (1 + item.tauxTVA / 100);
      const tvaItem = item.total - totalHT;
      return sum + Math.round(tvaItem * ratioGlobale * 100) / 100;
    }, 0);
  },

  total: () => get().sousTotal(),

  addItem: (item) => {
    set((state) => {
      const key = itemKey(item.produitId, item.varianteId);
      const existingIndex = state.items.findIndex((i) => itemKey(i.produitId, i.varianteId) === key);
      
      let nextItems = [...state.items];
      if (existingIndex >= 0) {
        nextItems[existingIndex] = {
          ...nextItems[existingIndex],
          quantite: nextItems[existingIndex].quantite + item.quantite
        };
      } else {
        // Ajouter un item temporaire pour le recalcul
        nextItems.push({ ...item, prixGrosApplique: false, prixUnitaire: item.prixBase, total: 0 });
      }

      return recalculateCart(nextItems, state.paliersAccepte);
    });
  },

  updateQuantite: (key, quantite) => {
    if (quantite <= 0) { 
      get().removeItem(key); 
      return; 
    }
    set((state) => {
      const nextItems = state.items.map((i) => 
        itemKey(i.produitId, i.varianteId) === key ? { ...i, quantite } : i
      );
      return recalculateCart(nextItems, state.paliersAccepte);
    });
  },

  updateRemise: (key, remise) => {
    set((state) => {
      const nextItems = state.items.map((i) => 
        itemKey(i.produitId, i.varianteId) === key ? { ...i, remise } : i
      );
      return recalculateCart(nextItems, state.paliersAccepte);
    });
  },

  removeItem: (key) => {
    set((state) => {
      const nextItems = state.items.filter((i) => itemKey(i.produitId, i.varianteId) !== key);
      return recalculateCart(nextItems, state.paliersAccepte);
    });
  },

  repondrePalier: (produitId, accepte) => {
    set((state) => {
      const newPaliersAccepte = { ...state.paliersAccepte, [produitId]: accepte };
      return recalculateCart(state.items, newPaliersAccepte);
    });
  },

  setClient: (clientId, clientNom) => set({ clientId, clientNom }),
  clearClient: () => set({ clientId: undefined, clientNom: undefined }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: remise }),
  setModePaiement: (mode) => set({ modePaiement: mode }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({ items: [], paliersAccepte: {}, clientId: undefined, clientNom: undefined, remiseGlobale: 0, modePaiement: "ESPECES", notes: "" }),
}));

