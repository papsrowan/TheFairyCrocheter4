// ─────────────────────────────────────────────────────────────────────────────
// TYPES GLOBAUX — Étend les types Next-Auth + types métier partagés
// ─────────────────────────────────────────────────────────────────────────────

import type { Role } from "@prisma/client";

// Extension de la session Next-Auth pour inclure les données métier
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      nom: string;
      prenom: string;
      role: Role;
    };
  }

  interface User {
    id: string;
    nom: string;
    prenom: string;
    role: Role;
  }
}

// Note: next-auth/jwt module augmentation is handled via next-auth declaration above


// ─── Types de réponse API standardisés ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Types SSE (Server-Sent Events) ─────────────────────────────────────────

export type SSEEventType =
  | "vente.created"
  | "vente.updated"
  | "vente.annulee"
  | "vente.prix_special"
  | "stock.updated"
  | "stock.alert"
  | "stock.alerte"
  | "client.created"
  | "client.updated"
  | "produit.created"
  | "produit.updated"
  | "finance.updated"
  | "demande.traitee"
  | "ping";

export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

// ─── Types offline / sync ────────────────────────────────────────────────────

export interface OfflineAction {
  id: string;               // ID temporaire local (cuid)
  type: "vente" | "client" | "stock_adjustment";
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  lastError?: string;
}

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

// ─── Types métier partagés ────────────────────────────────────────────────────

export interface DashboardStats {
  ventesAujourdhui: number;
  chiffreAffairesAujourdhui: number;
  ventesHier: number;
  chiffreAffairesHier: number;
  produitsCritiques: number;
  clientsActifs: number;
  evolutionVentes: number; // % vs hier
}

export interface StockAlert {
  produitId: string;
  nom: string;
  codeBarres?: string;
  stockActuel: number;
  stockMinimum: number;
}
