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

        const venteCreee = await prisma.$transaction(async (tx) => {
          let sousTotal = 0;
          let montantTVA = 0;

          // 1. Vérification et récupération des produits et variantes
          const produitsMap = new Map<string, { stockActuel: number; nom: string }>();
          const variantesMap = new Map<string, { stockActuel: number; couleur: string }>();

          for (const ligne of venteData.lignes) {
            const produit = await tx.produit.findUnique({
              where: { id: ligne.produitId },
              select: { id: true, stockActuel: true, nom: true, actif: true },
            });

            if (!produit || !produit.actif) {
              throw new Error(`Produit introuvable : ${ligne.produitId}`);
            }

            if (ligne.varianteId) {
              const variante = await tx.varianteProduit.findUnique({
                where: { id: ligne.varianteId },
                select: { id: true, stockActuel: true, couleur: true },
              });
              if (!variante) throw new Error(`Variante introuvable : ${ligne.varianteId}`);
              if (variante.stockActuel < ligne.quantite) {
                throw new Error(
                  `Stock insuffisant pour "${produit.nom}" couleur "${variante.couleur}" (disponible : ${variante.stockActuel}, demandé : ${ligne.quantite})`
                );
              }
              variantesMap.set(ligne.varianteId, variante);
            } else if (produit.stockActuel < ligne.quantite) {
              throw new Error(
                `Stock insuffisant pour "${produit.nom}" (disponible : ${produit.stockActuel}, demandé : ${ligne.quantite})`
              );
            }

            produitsMap.set(ligne.produitId, produit);

            const ligneTTC = Math.max(0, ligne.prixUnitaire * ligne.quantite - ligne.remise);
            const ligneHT = ligneTTC / (1 + ligne.tauxTVA / 100);
            sousTotal += Math.round(ligneTTC * 100) / 100;
            montantTVA += Math.round((ligneTTC - ligneHT) * 100) / 100;
          }

          const totalCalcule = Math.max(0, sousTotal - venteData.remiseGlobale);
          const total = venteData.prixSpecial ?? totalCalcule;

          // 2. Génération du numéro de vente
          const lastVente = await tx.vente.findFirst({
            orderBy: { numero: "desc" },
            select: { numero: true },
          });
          const lastNum = lastVente
            ? parseInt(lastVente.numero.split("-")[2] ?? "0")
            : 0;
          const numero = generateNumeroVente(lastNum);

          const estCredit = venteData.modePaiement === "CREDIT";
          const montantPaye = venteData.montantPaye ?? null;
          const estPartiel = montantPaye !== null && montantPaye < total;
          const dateVente = venteData.dateFacture
            ? new Date(venteData.dateFacture)
            : new Date(action.createdAt);

          // 3. Créer la vente
          const vente = await tx.vente.create({
            data: {
              numero,
              clientId: venteData.clientId ?? null,
              userId: session.user.id,
              sousTotal,
              montantTVA,
              remiseGlobale: venteData.remiseGlobale,
              total,
              modePaiement: venteData.modePaiement,
              statutPaiement: (estCredit || estPartiel) ? "EN_ATTENTE" : "PAYE",
              montantPaye,
              dateFacture: venteData.dateFacture ? new Date(venteData.dateFacture) : null,
              dateEcheance: venteData.dateEcheance ? new Date(venteData.dateEcheance) : null,
              notes: venteData.notes,
              offlineId: action.id,
              synchedAt: new Date(),
              createdAt: dateVente,
              lignes: {
                create: venteData.lignes.map((l) => ({
                  produitId: l.produitId,
                  varianteId: l.varianteId ?? null,
                  quantite: l.quantite,
                  prixUnitaire: l.prixUnitaire,
                  remise: l.remise,
                  tauxTVA: l.tauxTVA,
                  total: Math.max(0, l.prixUnitaire * l.quantite - l.remise),
                })),
              },
            },
          });

          // 4. Décrémenter le stock
          for (const ligne of venteData.lignes) {
            const produitAvant = produitsMap.get(ligne.produitId)!;
            const produitApres = await tx.produit.update({
              where: { id: ligne.produitId },
              data: { stockActuel: { decrement: ligne.quantite } },
            });

            if (ligne.varianteId) {
              const varAvant = variantesMap.get(ligne.varianteId)!;
              const varApres = await tx.varianteProduit.update({
                where: { id: ligne.varianteId },
                data: { stockActuel: { decrement: ligne.quantite } },
              });
              await tx.mouvementStock.create({
                data: {
                  produitId: ligne.produitId,
                  varianteId: ligne.varianteId,
                  type: "SORTIE_VENTE",
                  quantite: ligne.quantite,
                  stockAvant: varAvant.stockActuel,
                  stockApres: varApres.stockActuel,
                  venteId: vente.id,
                  userId: session.user.id,
                  motif: `Vente offline ${numero} — couleur ${varApres.couleur}`,
                },
              });
            }

            await tx.mouvementStock.create({
              data: {
                produitId: ligne.produitId,
                type: "SORTIE_VENTE",
                quantite: ligne.quantite,
                stockAvant: produitAvant.stockActuel,
                stockApres: produitApres.stockActuel,
                venteId: vente.id,
                userId: session.user.id,
                motif: `Vente offline ${numero}`,
              },
            });

            const produit = await tx.produit.findUnique({
              where: { id: ligne.produitId },
              select: { stockActuel: true, stockMinimum: true, nom: true },
            });
            if (produit && produit.stockActuel <= produit.stockMinimum) {
              emitSSE("stock.alert", {
                produitId: ligne.produitId,
                nom: produit.nom,
                stockActuel: produit.stockActuel,
                stockMinimum: produit.stockMinimum,
              });
            }
          }

          // 5. Création automatique de l'écriture financière RECETTE_VENTE
          if (!estCredit) {
            await tx.ecritureFinanciere.create({
              data: {
                venteId: vente.id,
                type: "RECETTE_VENTE",
                montant: total,
                description: `Vente ${numero}`,
                date: dateVente,
                metadata: {
                  modePaiement: venteData.modePaiement,
                  caissier: session.user.id,
                  offlineId: action.id,
                },
              },
            });
          } else if (montantPaye && montantPaye > 0) {
            await tx.ecritureFinanciere.create({
              data: {
                venteId: vente.id,
                type: "RECETTE_VENTE",
                montant: montantPaye,
                description: `Acompte vente crédit ${numero}`,
                date: dateVente,
                metadata: {
                  modePaiement: venteData.modePaiement,
                  caissier: session.user.id,
                  offlineId: action.id,
                },
              },
            });
          }

          // 6. Mise à jour du total d'achats du client
          if (venteData.clientId) {
            await tx.client.update({
              where: { id: venteData.clientId },
              data: {
                totalAchats: { increment: total },
                dernierAchat: dateVente,
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
