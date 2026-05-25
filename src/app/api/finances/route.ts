import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "finances:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = 30;
  const type = searchParams.get("type") ?? undefined;
  const dateDebut = searchParams.get("dateDebut");
  const dateFin = searchParams.get("dateFin");

  const where = {
    ...(type && { type: type as never }),
    ...(dateDebut || dateFin
      ? {
          date: {
            ...(dateDebut && { gte: new Date(dateDebut) }),
            ...(dateFin && { lte: new Date(dateFin + "T23:59:59Z") }),
          },
        }
      : {}),
  };

  // Stats du mois courant
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const debutMoisPrecedent = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMoisPrecedent = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [ecritures, total, statsMois, statsMoisPrecedent] = await Promise.all([
    prisma.ecritureFinanciere.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ecritureFinanciere.count({ where }),
    prisma.ecritureFinanciere.groupBy({
      by: ["type"],
      where: { date: { gte: debutMois } },
      _sum: { montant: true },
    }),
    prisma.ecritureFinanciere.groupBy({
      by: ["type"],
      where: { date: { gte: debutMoisPrecedent, lte: finMoisPrecedent } },
      _sum: { montant: true },
    }),
  ]);

  const sumByType = (stats: typeof statsMois, type: string) =>
    stats.find((s) => s.type === type)?._sum.montant ?? 0;

  const caMois = sumByType(statsMois, "RECETTE_VENTE");
  const depensesMois =
    sumByType(statsMois, "DEPENSE") + sumByType(statsMois, "REMBOURSEMENT");
  const caMoisPrecedent = sumByType(statsMoisPrecedent, "RECETTE_VENTE");

  return NextResponse.json({
    ecritures,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    stats: {
      caMois,
      depensesMois,
      beneficeMois: caMois - depensesMois,
      evolutionCA:
        caMoisPrecedent > 0
          ? Math.round(((caMois - caMoisPrecedent) / caMoisPrecedent) * 100)
          : null,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "finances:write"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  let body: { montant?: unknown; description?: unknown; date?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const montant = Number(body.montant);
  const description = String(body.description ?? "").trim();

  if (!montant || montant <= 0 || !description) {
    return NextResponse.json({ error: "Montant et description requis" }, { status: 400 });
  }

  const ecriture = await prisma.ecritureFinanciere.create({
    data: {
      type: "DEPENSE",
      montant,
      description,
      date: body.date ? new Date(String(body.date)) : new Date(),
      metadata: { userId: session.user.id },
    },
  });

  return NextResponse.json(ecriture, { status: 201 });
}
