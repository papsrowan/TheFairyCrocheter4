import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "parametres:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const entreprise = await prisma.entreprise.findFirst();
  return NextResponse.json({ entreprise });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "parametres:update"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const entreprise = await prisma.entreprise.findFirst();

  const data = {
    nom:                  String(body.nom ?? ""),
    adresse:              String(body.adresse ?? ""),
    codePostal:           String(body.codePostal ?? ""),
    ville:                String(body.ville ?? ""),
    telephone:            body.telephone ? String(body.telephone) : null,
    email:                body.email ? String(body.email) : null,
    siteWeb:              body.siteWeb ? String(body.siteWeb) : null,
    siret:                body.siret ? String(body.siret) : null,
    tvaIntracommunautaire: body.tvaIntracommunautaire ? String(body.tvaIntracommunautaire) : null,
    tauxTVADefaut:        body.tauxTVADefaut ? Number(body.tauxTVADefaut) : 20.0,
    mentionsLegales:      body.mentionsLegales ? String(body.mentionsLegales) : null,
    piedPageFacture:      body.piedPageFacture ? String(body.piedPageFacture) : null,
  };

  const updated = entreprise
    ? await prisma.entreprise.update({ where: { id: entreprise.id }, data })
    : await prisma.entreprise.create({ data });

  return NextResponse.json(updated);
}
