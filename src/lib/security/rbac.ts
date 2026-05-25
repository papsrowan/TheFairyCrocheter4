// ─────────────────────────────────────────────────────────────────────────────
// RBAC — Contrôle d'accès basé sur les rôles
// Appliqué côté serveur (middleware + API routes)
// ─────────────────────────────────────────────────────────────────────────────

import type { Role } from "@prisma/client";

// Hiérarchie des rôles (plus le niveau est élevé, plus l'accès est large)
export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  MANAGER: 3,
  CAISSIER: 2,
  DISTRIBUTEUR: 1,
};

// Permissions par module
export const PERMISSIONS = {
  // Ventes
  "ventes:read":    ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "ventes:create":  ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "ventes:update":  ["SUPER_ADMIN"] as Role[],                        // MANAGER doit demander autorisation
  "ventes:delete":  ["SUPER_ADMIN"] as Role[],
  "ventes:annuler": ["SUPER_ADMIN"] as Role[],                        // SUPER_ADMIN seulement

  // Produits — MANAGER lecture seule
  "produits:read":   ["SUPER_ADMIN", "MANAGER", "CAISSIER", "DISTRIBUTEUR"] as Role[],
  "produits:create": ["SUPER_ADMIN"] as Role[],
  "produits:update": ["SUPER_ADMIN"] as Role[],
  "produits:delete": ["SUPER_ADMIN"] as Role[],
  "stock:ajuster":   ["SUPER_ADMIN"] as Role[],

  // Clients — MANAGER peut créer/vérifier mais pas voir les fiches
  "clients:read":    ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[], // liste minimale
  "clients:details": ["SUPER_ADMIN"] as Role[],                        // fiche complète
  "clients:create":  ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "clients:update":  ["SUPER_ADMIN"] as Role[],
  "clients:delete":  ["SUPER_ADMIN"] as Role[],
  "clients:rgpd":    ["SUPER_ADMIN"] as Role[],

  // Finances — SUPER_ADMIN seulement
  "finances:read":   ["SUPER_ADMIN"] as Role[],
  "finances:write":  ["SUPER_ADMIN"] as Role[],
  "finances:export": ["SUPER_ADMIN"] as Role[],

  // Utilisateurs
  "utilisateurs:read":   ["SUPER_ADMIN"] as Role[],
  "utilisateurs:create": ["SUPER_ADMIN"] as Role[],
  "utilisateurs:update": ["SUPER_ADMIN"] as Role[],
  "utilisateurs:delete": ["SUPER_ADMIN"] as Role[],

  // Paramètres
  "parametres:read":   ["SUPER_ADMIN"] as Role[],
  "parametres:update": ["SUPER_ADMIN"] as Role[],

  // Documents
  "documents:read":   ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "documents:delete": ["SUPER_ADMIN"] as Role[],

  // Notes — MANAGER voit et crée ses propres notes (partagées auto avec SUPER_ADMIN)
  "notes:read":   ["SUPER_ADMIN", "MANAGER"] as Role[],
  "notes:create": ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "notes:delete": ["SUPER_ADMIN"] as Role[],

  // Dashboard
  "dashboard:read":     ["SUPER_ADMIN", "MANAGER", "CAISSIER"] as Role[],
  "dashboard:finances": ["SUPER_ADMIN"] as Role[],

  // Profil — tout le monde peut modifier son propre mot de passe
  "profil:update": ["SUPER_ADMIN", "MANAGER", "CAISSIER", "DISTRIBUTEUR"] as Role[],

  // Demandes d'approbation
  "demandes:create":  ["MANAGER"] as Role[],
  "demandes:read":    ["SUPER_ADMIN", "MANAGER"] as Role[],
  "demandes:approve": ["SUPER_ADMIN"] as Role[],

  // Commentaires sur activités (notes liées aux ventes)
  "activite:commenter": ["SUPER_ADMIN"] as Role[],

  // Audit
  "audit:read": ["SUPER_ADMIN"] as Role[],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Vérifie si un rôle a une permission donnée
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly Role[]).includes(role);
}

/**
 * Vérifie si un rôle est au moins égal à un niveau minimum
 */
export function hasMinRole(role: Role, minRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
}

/**
 * Middleware helper : lève une erreur si la permission est refusée
 */
export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Accès refusé : permission '${permission}' requise`);
  }
}
