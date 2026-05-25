import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  RECETTE_VENTE: "Recette vente",
  REMBOURSEMENT: "Remboursement",
  DEPENSE: "Dépense",
  CORRECTION: "Correction",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "finances:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const dateDebut = searchParams.get("dateDebut");
  const dateFin = searchParams.get("dateFin");

  const ecritures = await prisma.ecritureFinanciere.findMany({
    where: {
      ...(dateDebut || dateFin
        ? {
            date: {
              ...(dateDebut && { gte: new Date(dateDebut) }),
              ...(dateFin && { lte: new Date(dateFin + "T23:59:59Z") }),
            },
          }
        : {}),
    },
    orderBy: { date: "asc" },
  });

  const lines = [
    "Date,Type,Description,Montant (XAF)",
    ...ecritures.map((e) => {
      const date = e.date.toLocaleDateString("fr-FR");
      const type = TYPE_LABELS[e.type] ?? e.type;
      const desc = `"${e.description.replace(/"/g, '""')}"`;
      const montant = e.montant.toFixed(0);
      return `${date},${type},${desc},${montant}`;
    }),
  ];

  const csv = lines.join("\n");
  const filename = `finances-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
