// ─────────────────────────────────────────────────────────────────────────────
// POST /api/produits/[id]/restore — Désarchiver un produit (actif=true)
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:update")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const produit = await prisma.produit.findUnique({ where: { id } });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  if (produit.actif) return NextResponse.json({ error: "Produit déjà actif" }, { status: 409 });

  await prisma.produit.update({ where: { id }, data: { actif: true, deletedAt: null } });

  await audit({
    userId:     session.user.id,
    action:     AUDIT_ACTIONS.PRODUIT_UPDATED,
    entityId:   id,
    entityType: "produit",
    details:    { action: "desarchive", nom: produit.nom },
  });

  return NextResponse.json({ success: true });
}
