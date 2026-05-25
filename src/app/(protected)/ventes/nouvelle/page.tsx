// ─────────────────────────────────────────────────────────────────────────────
// PAGE /ventes/nouvelle — Caisse enregistreuse POS
// Layout 2 colonnes : recherche produit (gauche) + panier (droite)
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { CaisseView } from "./CaisseView";

export const metadata: Metadata = { title: "Nouvelle vente" };

export default function NouvellePage() {
  return <CaisseView />;
}
