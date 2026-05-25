import { z } from "zod";

export const createClientSchema = z.object({
  nom: z.string().min(1, "Le nom est requis").max(100),
  prenom: z.string().max(100).optional().nullable(),
  email: z
    .string()
    .max(150)
    .refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: "L'adresse email n'est pas valide" }
    )
    .optional()
    .nullable(),
  telephone: z.string().max(30).optional().nullable(),
  adresse: z.string().max(500).optional().nullable(),
  codePostal: z.string().max(10).optional().nullable(),
  ville: z.string().max(100).optional().nullable(),
  categorieId: z.string().cuid().optional().nullable(),
  consentementRGPD: z.boolean().default(false),
});

export const updateClientSchema = createClientSchema.partial();

// Schéma pour le droit à l'oubli (RGPD)
export const anonymizeClientSchema = z.object({
  clientId: z.string().cuid(),
  motif: z.string().min(1, "Motif requis").max(500),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
