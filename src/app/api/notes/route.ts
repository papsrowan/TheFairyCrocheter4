import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "notes:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType") ?? undefined;
  const entityId = searchParams.get("entityId") ?? undefined;

  const role = session.user.role as Role;
  // MANAGER : voit uniquement ses propres notes
  const filterUserId = role === "MANAGER" ? session.user.id : undefined;

  const notes = await prisma.note.findMany({
    where: {
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...(filterUserId && { userId: filterUserId }),
    },
    orderBy: { createdAt: "desc" },
    include: { auteur: { select: { nom: true, prenom: true, role: true } } },
    take: 100,
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "notes:create"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: { contenu?: unknown; entityType?: unknown; entityId?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const contenu = String(body.contenu ?? "").trim();
  const entityType = String(body.entityType ?? "general");
  const entityId = String(body.entityId ?? "general");

  if (!contenu) return NextResponse.json({ error: "Contenu requis" }, { status: 400 });

  const note = await prisma.note.create({
    data: { contenu, entityType, entityId, userId: session.user.id },
    include: { auteur: { select: { nom: true, prenom: true, role: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
