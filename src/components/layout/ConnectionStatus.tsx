"use client";

// ─────────────────────────────────────────────────────────────────────────────
// CONNEXION STATUS — Indicateur online / offline / dégradé
// S'affiche dans la barre de navigation pour informer l'utilisateur
// ─────────────────────────────────────────────────────────────────────────────

import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineStore } from "@/stores/offlineStore";
import { cn } from "@/lib/utils/cn";
import { Wifi, WifiOff, CloudOff, RefreshCw } from "lucide-react";

export function ConnectionStatus() {
  const { isFullyOnline, isDegraded, isOffline } = useOnlineStatus();
  const { queue, syncStatus } = useOfflineStore();
  const pendingCount = queue.length;

  if (isFullyOnline && pendingCount === 0 && syncStatus !== "syncing") {
    // Mode normal — indicateur discret
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="hidden sm:inline">En ligne</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        {
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400":
            isDegraded || syncStatus === "error",
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400":
            isOffline,
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400":
            syncStatus === "syncing",
        }
      )}
    >
      {/* Icône d'état */}
      {isOffline && <WifiOff className="h-3.5 w-3.5" />}
      {isDegraded && <CloudOff className="h-3.5 w-3.5" />}
      {syncStatus === "syncing" && (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      )}
      {isFullyOnline && syncStatus !== "syncing" && (
        <Wifi className="h-3.5 w-3.5" />
      )}

      {/* Message */}
      <span>
        {isOffline && "Hors ligne"}
        {isDegraded && "Mode dégradé"}
        {syncStatus === "syncing" && "Synchronisation..."}
        {isFullyOnline && syncStatus !== "syncing" && pendingCount > 0 && (
          `${pendingCount} action${pendingCount > 1 ? "s" : ""} en attente`
        )}
      </span>
    </div>
  );
}
