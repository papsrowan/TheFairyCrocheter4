// ─────────────────────────────────────────────────────────────────────────────
// API /api/documents/recu/[id] — Données pour reçu thermique 80mm
// Retourne les données JSON pour impression navigateur
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "documents:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const [vente, entreprise] = await Promise.all([
    prisma.vente.findUnique({
      where: { id: params.id },
      include: {
        client: { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
        lignes: {
          include: { produit: { select: { nom: true, codeBarres: true } } },
        },
      },
    }),
    prisma.entreprise.findFirst(),
  ]);

  if (!vente) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  const entrepriseFinal = entreprise ?? {
    nom: "The Fairy Crocheter", adresse: "", codePostal: "", ville: "",
    telephone: null, piedPageFacture: "Merci de votre confiance.",
  };

  return NextResponse.json({ data: { vente, entreprise: entrepriseFinal } });
}
