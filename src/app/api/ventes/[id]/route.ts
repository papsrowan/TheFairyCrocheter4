// ─────────────────────────────────────────────────────────────────────────────
// API /api/ventes/[id] — GET (détail) + PATCH (annulation/remboursement)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateVenteSchema } from "@/lib/validations/vente.schema";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { emitSSE } from "@/lib/realtime/sse";
import { logger } from "@/lib/utils/logger";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── GET — Détail d'une vente ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "ventes:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const vente = await prisma.vente.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      vendeur: { select: { id: true, nom: true, prenom: true, email: true } },
      lignes: {
        include: {
          produit: {
            select: { id: true, nom: true, codeBarres: true, imageUrl: true },
          },
        },
      },
      documents: true,
      ecrituresFinancieres: true,
    },
  });

  if (!vente) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: vente });
}

// ─── PUT — Modification complète (SUPER_ADMIN uniquement) ────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: {
    clientId?: string | null;
    modePaiement: string;
    remiseGlobale: number;
    notes?: string | null;
    lignes: Array<{ produitId: string; quantite: number; prixUnitaire: number; remise: number; tauxTVA: number }>;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (!body.lignes?.length) return NextResponse.json({ error: "Au moins une ligne requise" }, { status: 422 });

  const venteActuelle = await prisma.vente.findUnique({
    where: { id: params.id },
    include: { lignes: true },
  });
  if (!venteActuelle) return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  if (venteActuelle.statut !== "COMPLETEE") return NextResponse.json({ error: "Seules les ventes complétées sont modifiables" }, { status: 409 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Restituer le stock des anciennes lignes
      for (const ancienne of venteActuelle.lignes) {
        const p = await tx.produit.update({
          where: { id: ancienne.produitId },
          data: { stockActuel: { increment: ancienne.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId: ancienne.produitId, type: "ENTREE", quantite: ancienne.quantite,
            stockAvant: p.stockActuel - ancienne.quantite, stockApres: p.stockActuel,
            venteId: venteActuelle.id, userId: session.user.id,
            motif: `Correction vente ${venteActuelle.numero} (ancien stock restitué)`,
          },
        });
      }

      // 2. Calculer nouveaux totaux
      const sousTotal = body.lignes.reduce((sum, l) => {
        const apresRemiseLigne = l.prixUnitaire * l.quantite * (1 - l.remise / 100);
        return sum + apresRemiseLigne;
      }, 0);
      const montantTVA = body.lignes.reduce((sum, l) => {
        const ht = l.prixUnitaire / (1 + l.tauxTVA / 100) * l.quantite * (1 - l.remise / 100);
        return sum + (l.prixUnitaire * l.quantite * (1 - l.remise / 100) - ht);
      }, 0);
      const total = Math.round(sousTotal * (1 - body.remiseGlobale / 100));

      // 3. Supprimer les anciennes lignes et recréer
      await tx.ligneVente.deleteMany({ where: { venteId: venteActuelle.id } });

      for (const l of body.lignes) {
        const totalLigne = Math.round(l.prixUnitaire * l.quantite * (1 - l.remise / 100) * (1 - body.remiseGlobale / 100));
        await tx.ligneVente.create({
          data: { venteId: venteActuelle.id, produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remise: l.remise, tauxTVA: l.tauxTVA, total: totalLigne },
        });
        // Déduire nouveau stock
        const p = await tx.produit.update({
          where: { id: l.produitId },
          data: { stockActuel: { decrement: l.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId: l.produitId, type: "SORTIE_VENTE" as const, quantite: l.quantite,
            stockAvant: p.stockActuel + l.quantite, stockApres: p.stockActuel,
            venteId: venteActuelle.id, userId: session.user.id,
            motif: `Correction vente ${venteActuelle.numero} (nouveau stock)`,
          },
        });
      }

      // 4. Mettre à jour la vente
      const venteMaj = await tx.vente.update({
        where: { id: venteActuelle.id },
        data: { clientId: body.clientId ?? null, modePaiement: body.modePaiement as import("@prisma/client").ModePaiement, remiseGlobale: body.remiseGlobale, notes: body.notes ?? null, sousTotal, montantTVA, total },
      });

      // 5. Corriger l'écriture financière
      const delta = total - venteActuelle.total;
      if (delta !== 0) {
        await tx.ecritureFinanciere.create({
          data: { venteId: venteActuelle.id, type: "RECETTE_VENTE", montant: delta, description: `Correction vente ${venteActuelle.numero} (+${delta > 0 ? "+" : ""}${delta} XAF)`, metadata: { operateur: session.user.id } },
        });
      }

      // 6. Corriger le total client
      if (venteActuelle.clientId) {
        await tx.client.update({ where: { id: venteActuelle.clientId }, data: { totalAchats: { decrement: venteActuelle.total } } });
      }
      if (body.clientId) {
        await tx.client.update({ where: { id: body.clientId }, data: { totalAchats: { increment: total } } });
      }

      return venteMaj;
    });

    await audit({ userId: session.user.id, action: AUDIT_ACTIONS.VENTE_UPDATED, entityId: venteActuelle.id, entityType: "vente", details: { numero: venteActuelle.numero, ancienTotal: venteActuelle.total, nouveauTotal: result.total } });
    emitSSE("vente.updated", { venteId: venteActuelle.id, numero: venteActuelle.numero });

    return NextResponse.json({ data: result });
  } catch (err) {
    logger.error({ err }, "Erreur modification vente");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── PATCH — Annulation ou remboursement ─────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "ventes:annuler")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateVenteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const vente = await prisma.vente.findUnique({
    where: { id: params.id },
    include: { lignes: true },
  });

  if (!vente) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }
  if (vente.statut !== "COMPLETEE") {
    return NextResponse.json(
      { error: `La vente est déjà ${vente.statut.toLowerCase()}` },
      { status: 409 }
    );
  }

  const { statut, notes, statutPaiement, modePaiementReel } = parsed.data;

  // Cas spécial : marquage paiement reçu (crédit → payé)
  if (statutPaiement === "PAYE" && !statut) {
    if (vente.statutPaiement !== "EN_ATTENTE") {
      return NextResponse.json({ error: "Cette vente est déjà marquée comme payée" }, { status: 409 });
    }
    const updated = await prisma.vente.update({
      where: { id: params.id },
      data: {
        statutPaiement: "PAYE",
        modePaiement:   (modePaiementReel ?? vente.modePaiement) as import("@prisma/client").ModePaiement,
      },
    });
    await prisma.ecritureFinanciere.create({
      data: {
        venteId:     vente.id,
        type:        "RECETTE_VENTE",
        montant:     vente.total,
        description: `Paiement reçu — ${vente.numero}`,
        date:        new Date(),
        metadata:    { operateur: session.user.id, modePaiement: modePaiementReel ?? vente.modePaiement },
      },
    });
    await audit({ userId: session.user.id, action: AUDIT_ACTIONS.VENTE_UPDATED, entityId: vente.id, entityType: "vente", details: { numero: vente.numero, action: "paiement_reçu" } });
    emitSSE("vente.updated", { venteId: vente.id, numero: vente.numero });
    return NextResponse.json({ data: updated });
  }

  try {
    const venteModifiee = await prisma.$transaction(async (tx) => {
      const updated = await tx.vente.update({
        where: { id: params.id },
        data: { statut, notes },
      });

      // Si annulation ou remboursement → restituer le stock
      if (statut === "ANNULEE" || statut === "REMBOURSEE") {
        for (const ligne of vente.lignes) {
          const produit = await tx.produit.update({
            where: { id: ligne.produitId },
            data: { stockActuel: { increment: ligne.quantite } },
          });

          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              type: "ENTREE",
              quantite: ligne.quantite,
              stockAvant: produit.stockActuel - ligne.quantite,
              stockApres: produit.stockActuel,
              venteId: vente.id,
              userId: session.user.id,
              motif: `${statut === "ANNULEE" ? "Annulation" : "Remboursement"} vente ${vente.numero}`,
            },
          });
        }

        // Écriture financière de correction
        await tx.ecritureFinanciere.create({
          data: {
            venteId: vente.id,
            type: "REMBOURSEMENT",
            montant: -vente.total,
            description: `${statut === "ANNULEE" ? "Annulation" : "Remboursement"} ${vente.numero}`,
            metadata: { operateur: session.user.id, motif: notes },
          },
        });

        // Mise à jour du total client
        if (vente.clientId) {
          await tx.client.update({
            where: { id: vente.clientId },
            data: { totalAchats: { decrement: vente.total } },
          });
        }
      }

      return updated;
    });

    emitSSE("vente.annulee", { venteId: vente.id, statut, numero: vente.numero });

    await audit({
      userId: session.user.id,
      action: statut === "ANNULEE" ? AUDIT_ACTIONS.VENTE_ANNULEE : AUDIT_ACTIONS.VENTE_REMBOURSEE,
      entityId: vente.id,
      entityType: "vente",
      details: { numero: vente.numero, statut, notes },
    });

    logger.info({ venteId: vente.id, statut }, "Statut vente modifié");

    return NextResponse.json({ data: venteModifiee });
  } catch (err) {
    logger.error({ err }, "Erreur modification vente");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
