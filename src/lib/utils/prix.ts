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

/** 
 * Calcule le coût total pour une quantité donnée en appliquant les paliers
 * de manière fractionnée (greedy).
 * Exemple : si prix = 2000, palier 20 -> 800, palier 10 -> 1000.
 * Pour 32 : (20 * 800) + (10 * 1000) + (2 * 2000) = 30000.
 */
export function calculerTotalPaliersFractionnes(
  prixBase: number,
  paliers: Palier[] | undefined | null,
  quantiteTotale: number
): number {
  if (quantiteTotale <= 0) return 0;
  if (!paliers || paliers.length === 0) return prixBase * quantiteTotale;

  // Trier les paliers par quantité décroissante (les plus grands blocs d'abord)
  const paliersDesc = [...paliers].sort((a, b) => b.quantiteMin - a.quantiteMin);

  let reste = quantiteTotale;
  let totalCost = 0;

  for (const p of paliersDesc) {
    if (p.quantiteMin <= 0) continue;
    // Combien de blocs entiers de ce palier on peut faire avec le reste ?
    // ex: 32 / 20 = 1 (on prend 1 fois 20 items au prix de 800)
    // Wait, the prompt says "si le client prend 32 il y a 20 qui aura le prix de 800". 
    // It means we can take MULTIPLE blocks of the same tier? 
    // "à partir de 10 -> 1000". This usually means ANY multiple of 10? 
    // Yes, 20 items -> 800.
    const nbBlocs = Math.floor(reste / p.quantiteMin);
    if (nbBlocs > 0) {
      const qteDansCePalier = nbBlocs * p.quantiteMin;
      totalCost += qteDansCePalier * p.prixUnitaire;
      reste -= qteDansCePalier;
    }
  }

  // Le reste est au prix de base
  if (reste > 0) {
    totalCost += reste * prixBase;
  }

  return totalCost;
}
