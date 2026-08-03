// ─────────────────────────────────────────────────────────────────────────────
// Paliers de prix dégressifs — calcul du prix unitaire selon la quantité.
// Le prix appliqué = celui du palier au `quantiteMin` le plus élevé qui reste
// ≤ à la quantité commandée. Si aucun palier ne s'applique → prixVente (prix détail).
// ─────────────────────────────────────────────────────────────────────────────

export interface Palier {
  quantiteMin: number;
  prixUnitaire: number;
}

/** Prix unitaire pour une quantité donnée, en tenant compte des paliers. */
export function prixUnitairePourQuantite(
  prixVente: number,
  paliers: Palier[] | undefined | null,
  quantite: number
): number {
  let prix = prixVente;
  let seuil = 0;
  for (const p of paliers ?? []) {
    if (p.quantiteMin <= quantite && p.quantiteMin > seuil) {
      seuil = p.quantiteMin;
      prix = p.prixUnitaire;
    }
  }
  return prix;
}

/** Trie les paliers par quantité croissante (pour l'affichage). */
export function trierPaliers<T extends Palier>(paliers: T[]): T[] {
  return [...paliers].sort((a, b) => a.quantiteMin - b.quantiteMin);
}
