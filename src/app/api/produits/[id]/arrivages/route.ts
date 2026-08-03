// ─────────────────────────────────────────────────────────────────────────────
// POST /api/produits/[id]/arrivages — Enregistrer un arrivage (apport de stock)
// regroupant plusieurs couleurs + quantités, à une date donnée.
// Crée les variantes couleur manquantes, incrémente les stocks (variante + global),
// écrit les mouvements de stock et l'arrivage avec ses lignes.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { emitSSE } from "@/lib/realtime/sse";
import { genArrivageRef } from "@/lib/utils/lot";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface LigneIn { couleur?: string; description?: string; quantite?: number; prixAchat?: number | null }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  let body: { motif?: string; lignes?: LigneIn[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  const lignes = (body.lignes ?? [])
    .map((l) => ({
      couleur: (l.couleur ?? "").trim(),
      description: (l.description ?? "").trim() || null,
      quantite: Number(l.quantite) || 0,
      prixAchat: l.prixAchat != null ? Number(l.prixAchat) : null,
    }))
    .filter((l) => l.couleur && l.quantite > 0);

  if (lignes.length === 0) {
    return NextResponse.json({ error: "Ajoutez au moins une couleur avec une quantité." }, { status: 422 });
  }

  const produit = await prisma.produit.findUnique({
    where: { id },
    include: { variantes: true },
  });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  if (!produit.actif) return NextResponse.json({ error: "Produit archivé" }, { status: 422 });

  try {
    const arrivage = await prisma.$transaction(async (tx) => {
      const lignesArrivage: { varianteId: string; couleur: string; quantite: number; prixAchat: number | null }[] = [];
      let totalQte = 0;

      for (const l of lignes) {
        // Trouver la variante couleur existante (par couleur exacte) ou la créer
        let variante = produit.variantes.find((v) => v.couleur.toLowerCase() === l.couleur.toLowerCase());
        if (!variante) {
          variante = await tx.varianteProduit.create({
            data: { produitId: id, couleur: l.couleur, description: l.description, stockActuel: 0 },
          });
        } else if (l.description) {
          await tx.varianteProduit.update({ where: { id: variante.id }, data: { description: l.description } });
        }

        const vAvant = variante.stockActuel;
        const vApres = vAvant + l.quantite;
        await tx.varianteProduit.update({ where: { id: variante.id }, data: { stockActuel: vApres } });

        // Mouvement variante (historique couleur)
        await tx.mouvementStock.create({
          data: {
            produitId: id, varianteId: variante.id, type: "ENTREE", quantite: l.quantite,
            stockAvant: vAvant, stockApres: vApres,
            motif: `Arrivage — couleur ${l.couleur}`, userId: session.user.id,
          },
        });
        // Le stock de cette variante en mémoire (pour d'éventuelles lignes même couleur)
        variante.stockActuel = vApres;

        lignesArrivage.push({ varianteId: variante.id, couleur: l.couleur, quantite: l.quantite, prixAchat: l.prixAchat });
        totalQte += l.quantite;
      }

      // Stock global = incrément total + un mouvement global
      const pAvant = produit.stockActuel;
      const pApres = pAvant + totalQte;
      await tx.produit.update({ where: { id }, data: { stockActuel: pApres } });
      await tx.mouvementStock.create({
        data: {
          produitId: id, type: "ENTREE", quantite: totalQte,
          stockAvant: pAvant, stockApres: pApres,
          motif: `Arrivage${body.motif ? " — " + body.motif : ""}`, userId: session.user.id,
        },
      });

      // Créer l'arrivage avec ses lignes
      return tx.arrivage.create({
        data: {
          produitId: id,
          reference: genArrivageRef(),
          motif: body.motif?.trim() || null,
          userId: session.user.id,
          lignes: { create: lignesArrivage },
        },
        include: { lignes: true },
      });
    });

    emitSSE("stock.updated", { produitId: id, type: "ENTREE" });
    await audit({
      userId: session.user.id, action: AUDIT_ACTIONS.STOCK_ADJUSTED,
      entityId: id, entityType: "produit",
      details: { arrivage: arrivage.reference, lignes: arrivage.lignes.length },
    });

    return NextResponse.json({ data: arrivage }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
