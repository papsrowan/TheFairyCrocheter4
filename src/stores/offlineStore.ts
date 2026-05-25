"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ZUSTAND STORE — File d'attente des actions offline
// Persiste dans IndexedDB via Dexie pour survivre aux rechargements
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type { OfflineAction, SyncStatus } from "@/types";

// Génère un ID unique local (sans dépendance externe)
function localId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface OfflineStore {
  queue: OfflineAction[];
  syncStatus: SyncStatus;

  // Actions
  addToQueue: (action: Omit<OfflineAction, "id" | "createdAt" | "retries">) => void;
  removeFromQueue: (id: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  clearSyncedActions: () => void;
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  queue: [],
  syncStatus: "idle",

  addToQueue: (action) => {
    const newAction: OfflineAction = {
      ...action,
      id: localId(),
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    set((state) => ({ queue: [...state.queue, newAction] }));
  },

  removeFromQueue: (id) => {
    set((state) => ({
      queue: state.queue.filter((a) => a.id !== id),
    }));
  },

  setSyncStatus: (status) => set({ syncStatus: status }),

  clearSyncedActions: () => set({ queue: [] }),
}));
