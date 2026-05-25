"use client";

import { useEffect } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { getOfflineDB } from "@/lib/offline/db";

// Peuple IndexedDB avec produits + clients quand en ligne
export function useOfflineCache() {
  const { isFullyOnline } = useOnlineStatus();

  useEffect(() => {
    if (!isFullyOnline) return;

    const db = getOfflineDB();
    if (!db) return;

    // Produits actifs
    fetch("/api/produits?pageSize=500&actif=true")
      .then((r) => r.json())
      .then((data) => {
        const produits = data?.produits ?? data?.data ?? [];
        if (produits.length > 0) {
          db.produits.bulkPut(
            produits.map((p: Record<string, unknown>) => ({
              id: p.id,
              nom: p.nom,
              codeBarres: p.codeBarres ?? undefined,
              prixVente: p.prixVente,
              tauxTVA: p.tauxTVA ?? 0,
              stockActuel: p.stockActuel ?? 0,
              stockMinimum: p.stockMinimum ?? 0,
              actif: p.actif ?? true,
              categorie: (p.categorie as Record<string, unknown>)?.nom as string ?? undefined,
              updatedAt: p.updatedAt ?? new Date().toISOString(),
            }))
          );
        }
      })
      .catch(() => {});

    // Clients
    fetch("/api/clients?pageSize=500")
      .then((r) => r.json())
      .then((data) => {
        const clients = data?.clients ?? data?.data ?? [];
        if (clients.length > 0) {
          db.clients.bulkPut(
            clients.map((c: Record<string, unknown>) => ({
              id: c.id,
              nom: c.nom,
              prenom: c.prenom ?? undefined,
              email: c.email ?? undefined,
              telephone: c.telephone ?? undefined,
              categorieId: c.categorieId ?? undefined,
              remise: c.remise ?? undefined,
              updatedAt: c.updatedAt ?? new Date().toISOString(),
            }))
          );
        }
      })
      .catch(() => {});
  }, [isFullyOnline]);
}
