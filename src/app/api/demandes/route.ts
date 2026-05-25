import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.role as Role;
  if (!hasPermission(role, "demandes:read")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const where = role === "MANAGER" ? { demandeurId: session.user.id } : {};

  const demandes = await prisma.demandeApprobation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      vente:     { select: { numero: true, total: true, createdAt: true } },
      demandeur: { select: { nom: true, prenom: true } },
    },
  });

  return NextResponse.json({ data: demandes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "demandes:create"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: { venteId?: string; type?: string; motif?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (!body.venteId || !body.type || !body.motif?.trim())
    return NextResponse.json({ error: "venteId, type et motif requis" }, { status: 422 });

  const vente = await prisma.vente.findUnique({ where: { id: body.venteId } });
  if (!vente || vente.statut !== "COMPLETEE")
    return NextResponse.json({ error: "Vente introuvable ou non modifiable" }, { status: 404 });

  // Une seule demande EN_ATTENTE par vente
  const existante = await prisma.demandeApprobation.findFirst({
    where: { venteId: body.venteId, statut: "EN_ATTENTE" },
  });
  if (existante) return NextResponse.json({ error: "Une demande est déjà en attente pour cette vente" }, { status: 409 });

  const demande = await prisma.demandeApprobation.create({
    data: {
      venteId:     body.venteId,
      demandeurId: session.user.id,
      type:        body.type as "ANNULATION" | "REMBOURSEMENT" | "MODIFICATION",
      motif:       body.motif.trim(),
    },
  });

  return NextResponse.json({ data: demande }, { status: 201 });
}
