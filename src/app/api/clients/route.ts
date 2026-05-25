// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/clients — Liste paginée avec filtres + stats
// POST /api/clients — Créer un nouveau client
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rateLimit";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { emitSSE } from "@/lib/realtime/sse";
import { createClientSchema } from "@/lib/validations/client.schema";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// ─── GET /api/clients ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  const { searchParams } = req.nextUrl;
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit      = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
  const search     = searchParams.get("search")?.trim() ?? "";
  const categorieId = searchParams.get("categorieId") ?? "";

  const where: Prisma.ClientWhereInput = {
    // Exclure les clients anonymisés de la liste normale
    anonymiseLe: null,
  };

  if (search) {
    where.OR = [
      { nom:       { contains: search, mode: "insensitive" } },
      { prenom:    { contains: search, mode: "insensitive" } },
      { email:     { contains: search, mode: "insensitive" } },
      { telephone: { contains: search, mode: "insensitive" } },
      { ville:     { contains: search, mode: "insensitive" } },
    ];
  }
  if (categorieId) where.categorieId = categorieId;

  const skip = (page - 1) * limit;

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        categorie: true,
        _count: { select: { ventes: true } },
      },
      orderBy: { nom: "asc" },
      skip,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    data: clients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ─── POST /api/clients ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:create")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const limited = checkRateLimit(
    req.ip ?? req.headers.get("x-forwarded-for") ?? "unknown",
    RATE_LIMITS.api
  );
  if (!limited.success) return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Vérifier doublon (nom+prénom OU email OU téléphone)
  const doublon = await prisma.client.findFirst({
    where: {
      anonymiseLe: null,
      OR: [
        ...(data.email     ? [{ email:     data.email }]     : []),
        ...(data.telephone ? [{ telephone: data.telephone }] : []),
        { nom: data.nom, prenom: data.prenom ?? null },
      ],
    },
  });
  if (doublon) {
    // MANAGER ne voit pas les détails — message générique
    const msg = role === "SUPER_ADMIN"
      ? `Client déjà existant : ${doublon.prenom ? doublon.prenom + " " : ""}${doublon.nom}`
      : "Un client similaire existe déjà dans la base. Contactez le Super Admin pour plus de détails.";
    return NextResponse.json({ error: msg, code: "CLIENT_EXISTS" }, { status: 409 });
  }

  const client = await prisma.client.create({
    data: {
      nom:              data.nom,
      prenom:           data.prenom ?? null,
      email:            data.email ?? null,
      telephone:        data.telephone ?? null,
      adresse:          data.adresse ?? null,
      codePostal:       data.codePostal ?? null,
      ville:            data.ville ?? null,
      categorieId:      data.categorieId ?? null,
      consentementRGPD: data.consentementRGPD,
      consentementDate: data.consentementRGPD ? new Date() : null,
    },
    include: { categorie: true },
  });

  emitSSE("client.created", {
    clientId: client.id,
    nom:      client.nom,
    prenom:   client.prenom,
  });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.CLIENT_CREATED,
    entityId:   client.id,
    entityType: "client",
    details:    { nom: client.nom, email: client.email },
  });

  return NextResponse.json(client, { status: 201 });
}
