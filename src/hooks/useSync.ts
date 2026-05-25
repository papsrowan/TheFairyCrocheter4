"use client";

import { useEffect, useRef, useCallback } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { useOfflineStore } from "@/stores/offlineStore";

export function useSync() {
  const { isFullyOnline } = useOnlineStatus();
  const { queue, removeFromQueue, setSyncStatus } = useOfflineStore();
  const isSyncing = useRef(false);

  const sync = useCallback(async () => {
    if (isSyncing.current || queue.length === 0) return;
    isSyncing.current = true;
    setSyncStatus("syncing");

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions: queue }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Retirer de la queue uniquement les actions synchées avec succès
      for (const result of data.results) {
        if (result.status === "success") {
          removeFromQueue(result.offlineId);
        }
      }

      setSyncStatus(data.failed > 0 ? "error" : "idle");
    } catch {
      setSyncStatus("error");
    } finally {
      isSyncing.current = false;
    }
  }, [queue, removeFromQueue, setSyncStatus]);

  // Déclencher la sync dès que la connexion revient et qu'il y a des actions
  useEffect(() => {
    if (isFullyOnline && queue.length > 0) {
      sync();
    }
  }, [isFullyOnline, queue.length, sync]);
}
