// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/clients/[id]/notes — Liste des notes du client
// POST /api/clients/[id]/notes — Ajouter une note interne
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const createNoteSchema = z.object({
  contenu: z.string().min(1, "Contenu requis").max(2000),
});

// ─── GET /api/clients/[id]/notes ─────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "notes:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  const notes = await prisma.note.findMany({
    where: { entityId: id, entityType: "client" },
    include: {
      auteur: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

// ─── POST /api/clients/[id]/notes ────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "notes:create")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id }, select: { id: true, anonymiseLe: true } });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  if (client.anonymiseLe) {
    return NextResponse.json({ error: "Client anonymisé — ajout de note impossible" }, { status: 422 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const note = await prisma.note.create({
    data: {
      contenu:    parsed.data.contenu,
      entityId:   id,
      entityType: "client",
      userId:     session.user.id,
    },
    include: {
      auteur: { select: { id: true, nom: true, prenom: true } },
    },
  });

  return NextResponse.json(note, { status: 201 });
}
