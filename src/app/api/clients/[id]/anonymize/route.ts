// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clients/[id]/anonymize — Droit à l'oubli RGPD
// Remplace toutes les données personnelles par des valeurs neutres
// Les ventes et l'historique financier sont préservés (obligation légale)
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:rgpd")) {
    return NextResponse.json({ error: "Permission refusée — SUPER_ADMIN requis" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  if (client.anonymiseLe) {
    return NextResponse.json(
      { error: "Ce client est déjà anonymisé", anonymiseLe: client.anonymiseLe },
      { status: 409 }
    );
  }

  // Récupérer le motif depuis le body (optionnel)
  let motif = "Droit à l'oubli RGPD";
  try {
    const body = await req.json();
    if (body?.motif && typeof body.motif === "string") motif = body.motif;
  } catch { /* body optionnel */ }

  // Anonymisation : remplacer toutes les données personnelles identifiantes
  const anonymise = await prisma.client.update({
    where: { id },
    data: {
      nom:              "Client anonymisé",
      prenom:           null,
      email:            null,       // libère le slot unique
      telephone:        null,
      adresse:          null,
      codePostal:       null,
      ville:            null,
      consentementRGPD: false,
      consentementDate: null,
      anonymiseLe:      new Date(),
    },
  });

  // Supprimer les notes associées (données personnelles indirectes)
  await prisma.note.deleteMany({ where: { entityId: id, entityType: "client" } });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.CLIENT_ANONYMIZED,
    entityId:   id,
    entityType: "client",
    details:    {
      nomOriginal:   client.nom,
      emailOriginal: client.email,
      motif,
      anonymiseLe:   anonymise.anonymiseLe,
    },
  });

  return NextResponse.json({
    success:     true,
    anonymiseLe: anonymise.anonymiseLe,
    message:     "Données personnelles supprimées conformément au RGPD. Historique financier conservé.",
  });
}
