"use client";

import { useState } from "react";
import { Trash2, CheckCircle, Loader2 } from "lucide-react";

export function ClearCacheButton() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function clearCache() {
    setState("loading");
    try {
      // 1. Vider les caches du Service Worker
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 2. Vider l'IndexedDB offline (Dexie — ne supprime pas les données serveur)
      const dbs = await window.indexedDB.databases?.() ?? [];
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }

      // 3. Vider sessionStorage uniquement (pas localStorage : conserve thème/sidebar)
      sessionStorage.clear();

      setState("done");
      setTimeout(() => {
        setState("idle");
        // Rechargement pour prendre en compte les nouveaux caches
        window.location.reload();
      }, 1500);
    } catch {
      setState("idle");
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-t">
      <div>
        <p className="text-sm font-medium">Vider les caches</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Supprime les caches PWA et hors-ligne. Aucune donnée n&apos;est effacée.
        </p>
      </div>
      <button
        onClick={clearCache}
        disabled={state !== "idle"}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all
                   hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ml-4"
      >
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "done"    && <CheckCircle className="h-4 w-4 text-green-600" />}
        {state === "idle"    && <Trash2 className="h-4 w-4 text-muted-foreground" />}
        {state === "loading" ? "Nettoyage..." : state === "done" ? "Fait !" : "Vider les caches"}
      </button>
    </div>
  );
}
