// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS — Ventes
// Validation stricte côté serveur (ne jamais faire confiance au client)
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

export const ligneVenteSchema = z.object({
  produitId:  z.string().cuid("ID produit invalide"),
  varianteId: z.string().cuid().optional().nullable(),
  quantite:   z.number().int().positive("Quantité doit être positive"),
  prixUnitaire: z.number().positive("Prix invalide"),
  remise:     z.number().min(0).max(100, "Remise entre 0 et 100%").default(0),
  tauxTVA:    z.number().min(0).max(100, "Taux TVA invalide"),
});

export const createVenteSchema = z.object({
  clientId: z.string().cuid().optional().nullable(),
  lignes: z
    .array(ligneVenteSchema)
    .min(1, "La vente doit contenir au moins un article"),
  remiseGlobale: z.number().min(0).max(100).default(0),
  modePaiement: z.enum(["ESPECES", "CARTE", "VIREMENT", "CHEQUE", "MIXTE", "CREDIT"]),
  notes: z.string().max(500).optional(),
  offlineId: z.string().optional(),
  prixSpecial: z.number().positive().optional().nullable(),
  motifPrixSpecial: z.string().max(300).optional().nullable(),
  montantPaye:  z.number().min(0).optional().nullable(),
  dateFacture:  z.string().datetime({ offset: true }).optional().nullable(),
  dateEcheance: z.string().datetime({ offset: true }).optional().nullable(),
});

export const updateVenteSchema = z.object({
  statut:         z.enum(["ANNULEE"]).optional(),
  notes:          z.string().max(500).optional(),
  statutPaiement: z.enum(["PAYE", "EN_ATTENTE"]).optional(),
  modePaiementReel: z.enum(["ESPECES", "CARTE", "VIREMENT", "CHEQUE", "MIXTE"]).optional(),
  // Règlement (paiement) par le client d'une vente à crédit — partiel ou total
  reglementCredit: z
    .object({
      montant: z.number().positive("Montant invalide"),
      modePaiement: z.enum(["ESPECES", "CARTE", "VIREMENT", "CHEQUE", "MIXTE"]).optional(),
    })
    .optional(),
});

export type CreateVenteInput = z.infer<typeof createVenteSchema>;
export type UpdateVenteInput = z.infer<typeof updateVenteSchema>;
