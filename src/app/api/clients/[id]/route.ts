// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/clients/[id] — Détail complet (ventes + notes)
// PATCH  /api/clients/[id] — Modifier un client
// DELETE /api/clients/[id] — Supprimer (si aucune vente liée)
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { emitSSE } from "@/lib/realtime/sse";
import { updateClientSchema } from "@/lib/validations/client.schema";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/clients/[id] ────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      categorie: true,
      ventes: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id:           true,
          numero:       true,
          total:        true,
          modePaiement: true,
          statut:       true,
          createdAt:    true,
          vendeur: { select: { nom: true, prenom: true } },
        },
      },
      _count: { select: { ventes: true } },
    },
  });

  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  return NextResponse.json(client);
}

// ─── PATCH /api/clients/[id] ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
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
    return NextResponse.json({ error: "Client anonymisé — modification impossible" }, { status: 422 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Vérifier unicité email si modifié
  if (data.email && data.email !== client.email) {
    const exists = await prisma.client.findUnique({ where: { email: data.email } });
    if (exists) {
      return NextResponse.json({ error: "Email déjà utilisé par un autre client" }, { status: 409 });
    }
  }

  const updated = await prisma.client.update({
    where: { id },
    data: {
      ...(data.nom             !== undefined && { nom: data.nom }),
      ...(data.prenom          !== undefined && { prenom: data.prenom }),
      ...(data.email           !== undefined && { email: data.email }),
      ...(data.telephone       !== undefined && { telephone: data.telephone }),
      ...(data.adresse         !== undefined && { adresse: data.adresse }),
      ...(data.codePostal      !== undefined && { codePostal: data.codePostal }),
      ...(data.ville           !== undefined && { ville: data.ville }),
      ...(data.categorieId     !== undefined && { categorieId: data.categorieId }),
      ...(data.consentementRGPD !== undefined && {
        consentementRGPD: data.consentementRGPD,
        consentementDate: data.consentementRGPD && !client.consentementRGPD ? new Date() : client.consentementDate,
      }),
    },
    include: { categorie: true },
  });

  emitSSE("client.updated", {
    clientId: updated.id,
    nom:      updated.nom,
  });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.CLIENT_UPDATED,
    entityId:   id,
    entityType: "client",
    details:    { avant: { nom: client.nom, email: client.email }, apres: data },
  });

  return NextResponse.json(updated);
}

// ─── DELETE /api/clients/[id] ─────────────────────────────────────────────────
// Suppression définitive uniquement si aucune vente n'est associée (SUPER_ADMIN)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { ventes: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Protéger l'intégrité financière : refuser si ventes associées
  if (client._count.ventes > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer : ${client._count.ventes} vente(s) associée(s). Utilisez l'anonymisation RGPD.`,
      },
      { status: 409 }
    );
  }

  // Supprimer les notes liées (polymorphiques, pas de cascade Prisma)
  await prisma.note.deleteMany({ where: { entityId: id, entityType: "client" } });
  await prisma.client.delete({ where: { id } });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.CLIENT_DELETED,
    entityId:   id,
    entityType: "client",
    details:    { nom: client.nom, email: client.email },
  });

  return NextResponse.json({ success: true });
}
