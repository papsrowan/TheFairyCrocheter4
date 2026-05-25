// ─────────────────────────────────────────────────────────────────────────────
// AUDIT — Journalisation de toutes les actions sensibles
// Append-only : les logs ne sont jamais modifiés ni supprimés
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";
import { logger } from "@/lib/utils/logger";
import { headers } from "next/headers";

export interface AuditContext {
  userId?: string;
  action: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
}

/**
 * Enregistre une action dans le journal d'audit
 * Non-bloquant : les erreurs sont logguées mais ne font pas échouer l'opération
 */
export async function audit(ctx: AuditContext): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
      headersList.get("x-real-ip") ??
      "unknown";
    const userAgent = headersList.get("user-agent") ?? undefined;

    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        action: ctx.action,
        entityId: ctx.entityId,
        entityType: ctx.entityType,
        details: ctx.details ? JSON.parse(JSON.stringify(ctx.details)) : undefined,
        ipAddress,
        userAgent,
      },
    });

    logger.info(
      { action: ctx.action, userId: ctx.userId, entityId: ctx.entityId },
      "Audit log créé"
    );
  } catch (err) {
    // Ne jamais bloquer l'opération principale à cause d'un échec d'audit
    logger.error({ err, ctx }, "Échec de création du log d'audit");
  }
}

// Actions d'audit prédéfinies
export const AUDIT_ACTIONS = {
  // Authentification
  AUTH_SIGNIN: "auth.signin",
  AUTH_SIGNOUT: "auth.signout",
  AUTH_FAILED: "auth.failed",

  // Ventes
  VENTE_CREATED: "vente.created",
  VENTE_UPDATED: "vente.updated",
  VENTE_ANNULEE: "vente.annulee",
  VENTE_REMBOURSEE: "vente.remboursee",
  VENTE_SYNCED: "vente.synced_from_offline",

  // Stock
  STOCK_ADJUSTED: "stock.adjusted",
  STOCK_ENTRY: "stock.entry",
  STOCK_ALERT: "stock.alert_triggered",

  // Clients
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_DELETED: "client.deleted",
  CLIENT_ANONYMIZED: "client.anonymized_rgpd",

  // Utilisateurs
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DEACTIVATED: "user.deactivated",
  USER_ROLE_CHANGED: "user.role_changed",

  // Documents
  DOCUMENT_GENERATED: "document.generated",
  DOCUMENT_SENT: "document.sent_by_email",
  DOCUMENT_ACCESSED: "document.accessed",

  // Produits
  PRODUIT_CREATED: "produit.created",
  PRODUIT_UPDATED: "produit.updated",
  PRODUIT_ARCHIVED: "produit.archived",

  // Paramètres
  SETTINGS_UPDATED: "settings.updated",
} as const;
