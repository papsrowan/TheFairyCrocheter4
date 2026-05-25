// ─────────────────────────────────────────────────────────────────────────────
// API /api/ventes — GET (liste paginée) + POST (création atomique)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createVenteSchema } from "@/lib/validations/vente.schema";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { hasPermission } from "@/lib/security/rbac";
import { emitSSE } from "@/lib/realtime/sse";
import { logger } from "@/lib/utils/logger";
import { generateNumeroVente } from "@/lib/utils/format";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── GET — Liste des ventes ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "ventes:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "20"));
  const statut = searchParams.get("statut");
  const clientId = searchParams.get("clientId");
  const dateDebut = searchParams.get("dateDebut");
  const dateFin = searchParams.get("dateFin");
  const search = searchParams.get("search");

  const where = {
    ...(statut && { statut: statut as "COMPLETEE" | "ANNULEE" | "REMBOURSEE" }),
    ...(clientId && { clientId }),
    ...(dateDebut || dateFin
      ? {
          createdAt: {
            ...(dateDebut && { gte: new Date(dateDebut) }),
            ...(dateFin && { lte: new Date(dateFin) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { numero: { contains: search, mode: "insensitive" as const } },
        { client: { nom: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [ventes, total] = await Promise.all([
    prisma.vente.findMany({
      where,
      include: {
        client: { select: { id: true, nom: true, prenom: true } },
        vendeur: { select: { id: true, nom: true, prenom: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.vente.count({ where }),
  ]);

  return NextResponse.json({
    data: ventes,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// ─── POST — Création d'une vente (transaction atomique) ──────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "ventes:create")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`ventes:${ip}`, RATE_LIMITS.ventes);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de requêtes, veuillez patienter" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  // Validation stricte avec Zod
  const parsed = createVenteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const venteData = parsed.data;

  try {
    const vente = await prisma.$transaction(async (tx) => {
      let sousTotal = 0;
      let montantTVA = 0;

      // 1. Vérification et récupération des produits
      const produitsMap = new Map<string, { stockActuel: number; nom: string; prixVente: number }>();
      const variantesMap = new Map<string, { stockActuel: number; couleur: string }>();
      for (const ligne of venteData.lignes) {
        const produit = await tx.produit.findUnique({
          where: { id: ligne.produitId },
          select: { id: true, stockActuel: true, nom: true, prixVente: true, actif: true },
        });

        if (!produit || !produit.actif) {
          throw new Error(`Produit introuvable : ${ligne.produitId}`);
        }

        // Si une variante est choisie, vérifier son stock spécifique
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

        const ligneHT = (ligne.prixUnitaire * ligne.quantite * (1 - ligne.remise / 100)) / (1 + ligne.tauxTVA / 100);
        const ligneTTC = ligneHT * (1 + ligne.tauxTVA / 100);
        sousTotal += Math.round(ligneTTC * 100) / 100;
        montantTVA += Math.round(ligneHT * (ligne.tauxTVA / 100) * 100) / 100;
      }

      const totalCalcule = Math.round(sousTotal * (1 - venteData.remiseGlobale / 100) * 100) / 100;
      const total = venteData.prixSpecial ?? totalCalcule;

      // 2. Génération du numéro de vente
      const lastVente = await tx.vente.findFirst({
        orderBy: { createdAt: "desc" },
        select: { numero: true },
      });
      const lastNum = lastVente ? parseInt(lastVente.numero.split("-")[2] ?? "0") : 0;
      const numero = generateNumeroVente(lastNum);

      // 3. Création de la vente
      const estCredit = venteData.modePaiement === "CREDIT";
      const montantPaye = venteData.montantPaye ?? null;
      const estPartiel = montantPaye !== null && montantPaye < total;
      const nouvelleVente = await tx.vente.create({
        data: {
          numero,
          clientId:      venteData.clientId ?? null,
          userId:        session.user.id,
          sousTotal,
          montantTVA,
          remiseGlobale: venteData.remiseGlobale,
          total,
          modePaiement:   venteData.modePaiement,
          statutPaiement: (estCredit || estPartiel) ? "EN_ATTENTE" : "PAYE",
          montantPaye:    montantPaye,
          dateFacture:    venteData.dateFacture ? new Date(venteData.dateFacture) : null,
          dateEcheance:   venteData.dateEcheance ? new Date(venteData.dateEcheance) : null,
          notes:          venteData.notes,
          offlineId:      venteData.offlineId ?? null,
          synchedAt:      venteData.offlineId ? new Date() : null,
          lignes: {
            create: venteData.lignes.map((l) => ({
              produitId:  l.produitId,
              varianteId: l.varianteId ?? null,
              quantite:   l.quantite,
              prixUnitaire: l.prixUnitaire,
              remise:     l.remise,
              tauxTVA:    l.tauxTVA,
              total: Math.round(l.prixUnitaire * l.quantite * (1 - l.remise / 100) * 100) / 100,
            })),
          },
        },
        include: {
          client: { select: { id: true, nom: true, prenom: true, email: true } },
          lignes: { include: { produit: { select: { id: true, nom: true } } } },
        },
      });

      // 4. Décrémentation atomique du stock (produit global + variante si applicable)
      for (const ligne of venteData.lignes) {
        const produitAvant = produitsMap.get(ligne.produitId)!;
        const produitApres = await tx.produit.update({
          where: { id: ligne.produitId },
          data: { stockActuel: { decrement: ligne.quantite } },
        });

        // Décrémenter aussi le stock de la variante couleur
        let stockVarianteApres: number | undefined;
        if (ligne.varianteId) {
          const varAvant = variantesMap.get(ligne.varianteId)!;
          const varApres = await tx.varianteProduit.update({
            where: { id: ligne.varianteId },
            data: { stockActuel: { decrement: ligne.quantite } },
          });
          stockVarianteApres = varApres.stockActuel;
          // Mouvement avec référence variante
          await tx.mouvementStock.create({
            data: {
              produitId:  ligne.produitId,
              varianteId: ligne.varianteId,
              type:       "SORTIE_VENTE",
              quantite:   ligne.quantite,
              stockAvant: varAvant.stockActuel,
              stockApres: varApres.stockActuel,
              venteId:    nouvelleVente.id,
              userId:     session.user.id,
              motif:      `Vente ${numero} — couleur ${varApres.couleur}`,
            },
          });
        }

        await tx.mouvementStock.create({
          data: {
            produitId:  ligne.produitId,
            type:       "SORTIE_VENTE",
            quantite:   ligne.quantite,
            stockAvant: produitAvant.stockActuel,
            stockApres: produitApres.stockActuel,
            venteId:    nouvelleVente.id,
            userId:     session.user.id,
            motif:      `Vente ${numero}`,
          },
        });

        // Alerte si stock sous le seuil minimum
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

      // 5. Écriture financière (append-only)
      await tx.ecritureFinanciere.create({
        data: {
          venteId: nouvelleVente.id,
          type: "RECETTE_VENTE",
          montant: total,
          description: `Vente ${numero}`,
          date: new Date(),
          metadata: { modePaiement: venteData.modePaiement, caissier: session.user.id },
        },
      });

      // 6. Mise à jour du total d'achats du client
      if (venteData.clientId) {
        await tx.client.update({
          where: { id: venteData.clientId },
          data: {
            totalAchats: { increment: total },
            dernierAchat: new Date(),
          },
        });
      }

      return nouvelleVente;
    });

    // 7. Prix spécial MANAGER → Note + SSE pour le Super Admin
    if (venteData.prixSpecial && session.user.role === "MANAGER") {
      const totalCalculeRef = Math.round(
        venteData.lignes.reduce((s, l) => {
          const ht = (l.prixUnitaire * l.quantite * (1 - l.remise / 100)) / (1 + l.tauxTVA / 100);
          return s + Math.round(ht * (1 + l.tauxTVA / 100) * 100) / 100;
        }, 0) * (1 - venteData.remiseGlobale / 100) * 100
      ) / 100;

      await prisma.note.create({
        data: {
          entityType: "vente",
          entityId:   vente.id,
          contenu:    `⚠️ Prix spécial appliqué par ${session.user.prenom ?? ""} ${session.user.nom} : ${venteData.prixSpecial.toLocaleString("fr-FR")} XAF (calculé : ${totalCalculeRef.toLocaleString("fr-FR")} XAF)${venteData.motifPrixSpecial ? ` — Motif : "${venteData.motifPrixSpecial}"` : ""}`,
          userId:     session.user.id,
        },
      });

      emitSSE("vente.prix_special", {
        venteId:      vente.id,
        numero:       vente.numero,
        prixCalcule:  totalCalculeRef,
        prixSpecial:  venteData.prixSpecial,
        motif:        venteData.motifPrixSpecial ?? null,
        manager:      `${session.user.prenom ?? ""} ${session.user.nom}`.trim(),
      });
    }

    // 8. Émission SSE vers tous les clients connectés
    emitSSE("vente.created", {
      venteId: vente.id,
      numero: vente.numero,
      total: vente.total,
      clientNom: vente.client ? `${vente.client.prenom ?? ""} ${vente.client.nom}`.trim() : null,
      vendeurId: session.user.id,
      createdAt: vente.createdAt,
    });

    // 9. Log d'audit
    await audit({
      userId: session.user.id,
      action: AUDIT_ACTIONS.VENTE_CREATED,
      entityId: vente.id,
      entityType: "vente",
      details: { numero: vente.numero, total: vente.total, lignesCount: vente.lignes.length },
    });

    logger.info({ venteId: vente.id, numero: vente.numero, total: vente.total, prixSpecial: !!venteData.prixSpecial }, "Vente créée");

    return NextResponse.json({ data: vente }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    logger.error({ err }, "Erreur création vente");

    // Erreurs métier (stock insuffisant, etc.) → 422
    if (message.includes("Stock insuffisant") || message.includes("introuvable")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }

    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
