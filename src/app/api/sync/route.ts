// ─────────────────────────────────────────────────────────────────────────────
// SYNC ENDPOINT — /api/sync
// Traite les actions offline en attente (Background Sync PWA)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createVenteSchema } from "@/lib/validations/vente.schema";
import { emitSSE } from "@/lib/realtime/sse";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { logger } from "@/lib/utils/logger";
import { generateNumeroVente } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const syncPayloadSchema = z.object({
  actions: z.array(
    z.object({
      id: z.string(),          // ID local temporaire
      type: z.enum(["vente"]),
      payload: z.unknown(),
      createdAt: z.string().datetime(),
    })
  ),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = syncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Format invalide", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const results: Array<{
    offlineId: string;
    status: "success" | "error";
    serverVenteId?: string;
    error?: string;
  }> = [];

  for (const action of parsed.data.actions) {
    if (action.type === "vente") {
      const venteParsed = createVenteSchema.safeParse(action.payload);
      if (!venteParsed.success) {
        results.push({
          offlineId: action.id,
          status: "error",
          error: "Vente invalide",
        });
        continue;
      }

      try {
        const venteData = venteParsed.data;

        // Calculer les totaux
        let sousTotal = 0;
        let montantTVA = 0;

        const venteCreee = await prisma.$transaction(async (tx) => {
          // Vérifier disponibilité stock
          for (const ligne of venteData.lignes) {
            const produit = await tx.produit.findUnique({
              where: { id: ligne.produitId },
              select: { stockActuel: true, nom: true },
            });

            if (!produit || produit.stockActuel < ligne.quantite) {
              throw new Error(
                `Stock insuffisant pour le produit ${produit?.nom ?? ligne.produitId}`
              );
            }

            const ligneTotal = ligne.prixUnitaire * ligne.quantite * (1 - ligne.remise / 100);
            const ligneHT = ligneTotal / (1 + ligne.tauxTVA / 100);
            sousTotal += ligneTotal;
            montantTVA += ligneHT * (ligne.tauxTVA / 100);
          }

          const totalApresRemise = sousTotal * (1 - venteData.remiseGlobale / 100);

          // Générer numéro de vente
          const lastVente = await tx.vente.findFirst({
            orderBy: { createdAt: "desc" },
            select: { numero: true },
          });
          const lastNum = lastVente
            ? parseInt(lastVente.numero.split("-")[2] ?? "0")
            : 0;
          const numero = generateNumeroVente(lastNum);

          // Créer la vente
          const vente = await tx.vente.create({
            data: {
              numero,
              clientId: venteData.clientId,
              userId: session.user.id,
              sousTotal,
              montantTVA,
              remiseGlobale: venteData.remiseGlobale,
              total: totalApresRemise,
              modePaiement: venteData.modePaiement,
              notes: venteData.notes,
              offlineId: action.id,
              synchedAt: new Date(),
              createdAt: new Date(action.createdAt),
              lignes: {
                create: venteData.lignes.map((l) => ({
                  produitId: l.produitId,
                  quantite: l.quantite,
                  prixUnitaire: l.prixUnitaire,
                  remise: l.remise,
                  tauxTVA: l.tauxTVA,
                  total: l.prixUnitaire * l.quantite * (1 - l.remise / 100),
                })),
              },
            },
          });

          // Décrémenter le stock
          for (const ligne of venteData.lignes) {
            const produit = await tx.produit.update({
              where: { id: ligne.produitId },
              data: { stockActuel: { decrement: ligne.quantite } },
            });

            await tx.mouvementStock.create({
              data: {
                produitId: ligne.produitId,
                type: "SORTIE_VENTE",
                quantite: ligne.quantite,
                stockAvant: produit.stockActuel + ligne.quantite,
                stockApres: produit.stockActuel,
                venteId: vente.id,
                userId: session.user.id,
              },
            });
          }

          return vente;
        });

        // Émettre l'événement SSE
        emitSSE("vente.created", { venteId: venteCreee.id, synchedFromOffline: true });

        await audit({
          userId: session.user.id,
          action: AUDIT_ACTIONS.VENTE_SYNCED,
          entityId: venteCreee.id,
          entityType: "vente",
          details: { offlineId: action.id },
        });

        results.push({
          offlineId: action.id,
          status: "success",
          serverVenteId: venteCreee.id,
        });

        logger.info(
          { offlineId: action.id, venteId: venteCreee.id },
          "Vente offline synchronisée"
        );
      } catch (err) {
        results.push({
          offlineId: action.id,
          status: "error",
          error: err instanceof Error ? err.message : "Erreur interne",
        });
        logger.error({ err, offlineId: action.id }, "Erreur sync vente offline");
      }
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}
