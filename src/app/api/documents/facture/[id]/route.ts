// ─────────────────────────────────────────────────────────────────────────────
// API /api/documents/facture/[id] — Génération et téléchargement PDF facture
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { FacturePDF } from "@/lib/pdf/factureTemplate";
import { hasPermission } from "@/lib/security/rbac";
import { audit, AUDIT_ACTIONS } from "@/lib/security/audit";
import { createElement } from "react";
import type { ReactElement } from "react";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!hasPermission(session.user.role as Role, "documents:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupération de la vente complète
  const vente = await prisma.vente.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      lignes: {
        include: {
          produit: { select: { nom: true, codeBarres: true } },
        },
      },
    },
  });

  if (!vente) {
    return NextResponse.json({ error: "Vente introuvable" }, { status: 404 });
  }

  // Récupération des paramètres entreprise — fallback si non configuré
  const entrepriseRaw = await prisma.entreprise.findFirst();
  const entreprise = entrepriseRaw ?? {
    nom: "The Fairy Crocheter", adresse: "", codePostal: "", ville: "",
    telephone: null, email: null, siteWeb: null, siret: null,
    tauxTVADefaut: 0, mentionsLegales: null, piedPageFacture: "Merci de votre confiance.",
  };

  try {
    // Génération du PDF côté serveur
    const element = createElement(FacturePDF, { vente, entreprise }) as ReactElement<DocumentProps>;
    const pdfBuffer = await renderToBuffer(element);

    await audit({
      userId: session.user.id,
      action: AUDIT_ACTIONS.DOCUMENT_GENERATED,
      entityId: vente.id,
      entityType: "vente",
      details: { type: "FACTURE", numero: vente.numero },
    });

    const filename = `facture-${vente.numero}.pdf`;
    // inline → s'ouvre dans le navigateur (iOS/Android/Desktop) + possibilité de télécharger
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length":      String(pdfBuffer.length),
        "Cache-Control":       "no-store, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Erreur génération PDF:", err);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 }
    );
  }
}
