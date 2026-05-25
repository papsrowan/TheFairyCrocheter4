import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ConditionRetour } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // Retour = SUPER_ADMIN uniquement
  if (session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: {
    venteId: string;
    motif: string;
    lignes: Array<{ produitId: string; varianteId?: string | null; quantite: number; prixUnitaire: number; condition: ConditionRetour }>;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.venteId || !body.motif?.trim() || !body.lignes?.length)
    return NextResponse.json({ error: "Données manquantes" }, { status: 422 });

  // Charger la vente avec ses lignes pour vérifications
  const vente = await prisma.vente.findUnique({
    where: { id: body.venteId },
    include: { lignes: true },
  });
  if (!vente || vente.statut !== "COMPLETEE")
    return NextResponse.json({ error: "Vente introuvable ou non éligible" }, { status: 404 });

  // Vérifier que chaque ligne retournée existe dans la vente et la quantité est valide
  for (const l of body.lignes) {
    const ligneVente = vente.lignes.find(lv =>
      lv.produitId === l.produitId &&
      (l.varianteId ? (lv as { varianteId?: string | null }).varianteId === l.varianteId : true)
    );
    if (!ligneVente)
      return NextResponse.json({ error: `Produit ${l.produitId} absent de cette vente` }, { status: 422 });

    // Calculer les retours déjà effectués sur ce produit/vente
    const dejaRetourne = await prisma.ligneRetour.aggregate({
      where: {
        produitId: l.produitId,
        retour: { venteId: body.venteId },
      },
      _sum: { quantite: true },
    });
    const qteDeja = dejaRetourne._sum.quantite ?? 0;
    if (l.quantite + qteDeja > ligneVente.quantite)
      return NextResponse.json({
        error: `Quantité retournée (${l.quantite + qteDeja}) dépasse la quantité vendue (${ligneVente.quantite}) pour ce produit`,
      }, { status: 422 });

    // Corriger le prix unitaire avec le prix réellement payé (après remise ligne)
    // On remplace le prixUnitaire envoyé par le frontend par la valeur exacte en base
    l.prixUnitaire = ligneVente.total / ligneVente.quantite;
  }

  const montant = body.lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);

  const retour = await prisma.$transaction(async (tx) => {
    const r = await tx.retourProduit.create({
      data: {
        venteId:          body.venteId,
        userId:           session.user.id,
        motif:            body.motif,
        montantRembourse: Math.round(montant * 100) / 100,
        lignes: {
          create: body.lignes.map(l => ({
            produitId:    l.produitId,
            varianteId:   l.varianteId ?? null,
            quantite:     l.quantite,
            prixUnitaire: l.prixUnitaire,
            condition:    l.condition,
          })),
        },
      },
    });

    for (const l of body.lignes) {
      const p = await tx.produit.update({
        where: { id: l.produitId },
        data: { stockActuel: { increment: l.quantite } },
      });
      // Restaurer le stock de la variante si applicable
      if (l.varianteId) {
        const v = await tx.varianteProduit.update({
          where: { id: l.varianteId },
          data: { stockActuel: { increment: l.quantite } },
        });
        await tx.mouvementStock.create({
          data: {
            produitId:  l.produitId,
            varianteId: l.varianteId,
            type:       "RETOUR",
            quantite:   l.quantite,
            stockAvant: v.stockActuel - l.quantite,
            stockApres: v.stockActuel,
            venteId:    body.venteId,
            userId:     session.user.id,
            motif:      `Retour client — ${body.motif} — couleur ${v.couleur} — état : ${l.condition}`,
          },
        });
      }
      await tx.mouvementStock.create({
        data: {
          produitId:  l.produitId,
          type:       "RETOUR",
          quantite:   l.quantite,
          stockAvant: p.stockActuel - l.quantite,
          stockApres: p.stockActuel,
          venteId:    body.venteId,
          userId:     session.user.id,
          motif:      `Retour client — ${body.motif} — état : ${l.condition}`,
        },
      });
    }

    await tx.ecritureFinanciere.create({
      data: {
        venteId:     body.venteId,
        type:        "REMBOURSEMENT",
        montant:     -(Math.round(montant * 100) / 100),
        description: `Retour produit vente ${vente.numero}`,
        metadata:    { motif: body.motif, auteur: session.user.id },
      },
    });

    // Décrémenter le total achats du client si associé
    if (vente.clientId) {
      await tx.client.update({
        where: { id: vente.clientId },
        data: { totalAchats: { decrement: Math.round(montant * 100) / 100 } },
      });
    }

    return r;
  });

  return NextResponse.json({ data: retour }, { status: 201 });
}
