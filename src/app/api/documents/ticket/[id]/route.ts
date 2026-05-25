import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { TicketPDF } from "@/lib/pdf/ticketTemplate";
import { hasPermission } from "@/lib/security/rbac";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "documents:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  const [vente, entreprise] = await Promise.all([
    prisma.vente.findUnique({
      where: { id },
      include: {
        client:  { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
        lignes: {
          include: {
            produit: { select: { nom: true, codeBarres: true } },
          },
        },
      },
    }),
    prisma.entreprise.findFirst(),
  ]);

  if (!vente)
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  const entrepriseFinal = entreprise ?? {
    nom: "The Fairy Crocheter", adresse: "", codePostal: "", ville: "",
    telephone: null, piedPageFacture: "Merci de votre confiance.",
  };

  try {
    const element = createElement(TicketPDF, { vente, entreprise: entrepriseFinal }) as ReactElement<DocumentProps>;
    const buf = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="ticket-${vente.numero}.pdf"; filename*=UTF-8''${encodeURIComponent(`ticket-${vente.numero}.pdf`)}`,
        "Content-Length":      String(buf.length),
        "Cache-Control":       "no-store, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Erreur génération ticket:", err);
    return NextResponse.json({ error: "Erreur génération ticket" }, { status: 500 });
  }
}
