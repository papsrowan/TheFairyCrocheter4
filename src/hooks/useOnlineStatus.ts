"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — Détection du statut en ligne / hors ligne
// Effectue aussi des health checks réguliers vers le serveur
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [serverReachable, setServerReachable] = useState(true);

  const checkServer = useCallback(async () => {
    try {
      const res = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(5000), // Timeout 5 secondes
      });
      setServerReachable(res.ok);
    } catch {
      setServerReachable(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkServer(); // Vérifier le serveur dès le retour de connexion réseau
    };

    const handleOffline = () => {
      setIsOnline(false);
      setServerReachable(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Health check toutes les 30 secondes si en ligne
    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkServer();
      }
    }, 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [checkServer]);

  return {
    isOnline,
    serverReachable,
    // Mode dégradé = connexion réseau OK mais serveur injoignable
    isDegraded: isOnline && !serverReachable,
    // Mode offline total = pas de réseau
    isOffline: !isOnline,
    // Entièrement opérationnel
    isFullyOnline: isOnline && serverReachable,
  };
}
