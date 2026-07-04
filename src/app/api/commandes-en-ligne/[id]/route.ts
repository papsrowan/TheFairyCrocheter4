// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/commandes-en-ligne/[id] — Valider / refuser / faire évoluer une
// commande passée depuis la boutique en ligne (base partagée).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUTS = ["EN_ATTENTE", "VALIDEE", "REFUSEE", "EXPEDIEE", "LIVREE", "ANNULEE"] as const;
type StatutCommande = (typeof STATUTS)[number];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const role = session.user.role as Role;
  if (role !== "SUPER_ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: { statut?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }

  if (!body.statut || !STATUTS.includes(body.statut as StatutCommande)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 422 });
  }

  const commande = await prisma.commande.findUnique({ where: { id: params.id } });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const updated = await prisma.commande.update({
    where: { id: params.id },
    data: { statut: body.statut as StatutCommande },
  });

  return NextResponse.json({ data: updated });
}
