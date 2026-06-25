import { z } from "zod";

const varianteSchema = z.object({
  id:          z.string().optional(),
  couleur:     z.string().min(1).max(50),
  description: z.string().max(120).optional().nullable(),
  stockActuel: z.number().int().min(0).default(0),
});

export const createProduitSchema = z.object({
  nom:             z.string().min(1, "Nom requis").max(200),
  description:     z.string().max(2000).optional(),
  codeBarres:      z.string().max(50).optional().nullable(),
  categorieId:     z.string().optional().nullable(),
  prixVente:       z.number().positive("Prix de vente invalide"),
  prixGros:        z.number().min(0).optional().nullable(),
  qtePrixGros:     z.number().int().min(0).optional().nullable(),
  prixAchat:       z.number().min(0).default(0),
  tauxTVA:         z.number().min(0).max(100).default(0),
  stockActuel:     z.number().int().min(0).default(0),
  stockMinimum:    z.number().int().min(0).default(5),
  imageUrl:        z.string().optional().nullable(),
  couleur:         z.string().max(50).optional().nullable(),
  poids:           z.string().max(20).optional().nullable(),
  dateAcquisition: z.string().optional().nullable(),
  variantes:       z.array(varianteSchema).optional().default([]),
});

export const updateProduitSchema = createProduitSchema.partial();

export const ajusterStockSchema = z.object({
  produitId:    z.string().cuid(),
  varianteId:   z.string().cuid().optional().nullable(),
  type:         z.enum(["ENTREE", "SORTIE_MANUELLE", "CORRECTION", "INVENTAIRE"]),
  quantite:     z.number().int().positive("Quantité doit être positive"),
  motif:        z.string().max(500).optional(),
  nouveauStock: z.number().int().min(0).optional(),
});

export type CreateProduitInput = z.infer<typeof createProduitSchema>;
export type UpdateProduitInput = z.infer<typeof updateProduitSchema>;
export type AjusterStockInput  = z.infer<typeof ajusterStockSchema>;
