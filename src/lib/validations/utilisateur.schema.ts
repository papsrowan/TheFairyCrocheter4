import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(8, "8 caractères minimum")
    .regex(/[A-Z]/, "Doit contenir une majuscule")
    .regex(/[0-9]/, "Doit contenir un chiffre")
    .regex(/[^A-Za-z0-9]/, "Doit contenir un caractère spécial"),
  nom: z.string().min(1).max(100),
  prenom: z.string().min(1).max(100),
  role: z.enum(["SUPER_ADMIN", "MANAGER", "CAISSIER", "DISTRIBUTEUR"]),
});

export const updateUserSchema = z.object({
  nom: z.string().min(1).max(100).optional(),
  prenom: z.string().min(1).max(100).optional(),
  role: z
    .enum(["SUPER_ADMIN", "MANAGER", "CAISSIER", "DISTRIBUTEUR"])
    .optional(),
  actif: z.boolean().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
