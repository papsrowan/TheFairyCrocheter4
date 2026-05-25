import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { emitSSE } from "@/lib/realtime/sse";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "demandes:approve"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: { statut?: "APPROUVEE" | "REJETEE"; reponse?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  if (!body.statut || !["APPROUVEE", "REJETEE"].includes(body.statut))
    return NextResponse.json({ error: "statut invalide" }, { status: 422 });

  const demande = await prisma.demandeApprobation.findUnique({
    where: { id: params.id },
    include: { vente: { include: { lignes: true } } },
  });
  if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  if (demande.statut !== "EN_ATTENTE") return NextResponse.json({ error: "Demande déjà traitée" }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    await tx.demandeApprobation.update({
      where: { id: params.id },
      data: { statut: body.statut, reponse: body.reponse ?? null },
    });

    if (body.statut === "APPROUVEE") {
      const newStatut = demande.type === "ANNULATION" ? "ANNULEE" : "REMBOURSEE";

      if (demande.type !== "MODIFICATION") {
        await tx.vente.update({ where: { id: demande.venteId }, data: { statut: newStatut } });

        for (const ligne of demande.vente.lignes) {
          const p = await tx.produit.update({
            where: { id: ligne.produitId },
            data: { stockActuel: { increment: ligne.quantite } },
          });
          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId, type: "ENTREE", quantite: ligne.quantite,
              stockAvant: p.stockActuel - ligne.quantite, stockApres: p.stockActuel,
              venteId: demande.venteId, userId: session.user.id,
              motif: `${newStatut} vente ${demande.vente.numero} (approuvé par SUPER_ADMIN)`,
            },
          });
        }

        await tx.ecritureFinanciere.create({
          data: {
            venteId: demande.venteId, type: "REMBOURSEMENT",
            montant: -demande.vente.total,
            description: `${newStatut} vente ${demande.vente.numero}`,
            metadata: { operateur: session.user.id, demandeId: demande.id },
          },
        });

        // Corriger le total achats du client
        if (demande.vente.clientId) {
          await tx.client.update({
            where: { id: demande.vente.clientId },
            data: { totalAchats: { decrement: demande.vente.total } },
          });
        }
      }
    }
  });

  emitSSE("demande.traitee", { demandeId: params.id, statut: body.statut });
  return NextResponse.json({ success: true });
}
