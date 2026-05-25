// ─────────────────────────────────────────────────────────────────────────────
// INDEXEDDB — Base de données locale (Dexie.js) pour mode offline
// Stockage : produits, clients, ventes en attente de sync
// ─────────────────────────────────────────────────────────────────────────────

import Dexie, { type Table } from "dexie";
import type { OfflineAction } from "@/types";

// Types des tables locales
interface CachedProduit {
  id: string;
  nom: string;
  codeBarres?: string;
  prixVente: number;
  tauxTVA: number;
  stockActuel: number;
  stockMinimum: number;
  actif: boolean;
  categorie?: string;
  updatedAt: string;
}

interface CachedClient {
  id: string;
  nom: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  categorieId?: string;
  remise?: number;
  updatedAt: string;
}

interface VenteDraft {
  id: string;           // ID local temporaire
  lignes: Array<{
    produitId: string;
    nom: string;
    quantite: number;
    prixUnitaire: number;
    remise: number;
    tauxTVA: number;
  }>;
  clientId?: string;
  clientNom?: string;
  modePaiement: string;
  total: number;
  createdAt: string;
  synced: boolean;
}

class GestionCommercialeDB extends Dexie {
  produits!: Table<CachedProduit>;
  clients!: Table<CachedClient>;
  ventesDraft!: Table<VenteDraft>;
  offlineQueue!: Table<OfflineAction>;

  constructor() {
    super("GestionCommerciale");

    this.version(1).stores({
      produits: "id, codeBarres, nom, actif",
      clients: "id, nom, email",
      ventesDraft: "id, synced, createdAt",
      offlineQueue: "id, type, createdAt",
    });
  }
}

// Singleton — une seule instance partagée côté client
let _db: GestionCommercialeDB | null = null;

export const getOfflineDB = (): GestionCommercialeDB | null => {
  if (typeof window === "undefined") return null;
  if (!_db) _db = new GestionCommercialeDB();
  return _db;
};

export type { CachedProduit, CachedClient, VenteDraft };
