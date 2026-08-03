// ─────────────────────────────────────────────────────────────────────────────
// GET /api/produits/[id]/arrivages/export?format=csv|pdf
// Exporte les arrivages (apports de stock datés) d'un produit en Excel (CSV) ou PDF
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "produits:read"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "csv";

  const produit = await prisma.produit.findUnique({
    where: { id },
    include: { arrivages: { orderBy: { dateEntree: "desc" }, include: { lignes: true } } },
  });
  if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

  // Aplatir : une ligne = (arrivage, couleur, quantité)
  const rows = produit.arrivages.flatMap((a) =>
    a.lignes.map((l) => ({
      reference: a.reference,
      date: new Date(a.dateEntree).toLocaleDateString("fr-FR"),
      couleur: l.couleur,
      quantite: l.quantite,
      prixAchat: l.prixAchat != null ? String(l.prixAchat) : "",
    }))
  );
  const totalQte = rows.reduce((s, r) => s + r.quantite, 0);
  const safeName = produit.nom.replace(/[^a-zA-Z0-9-_]/g, "_");

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (format === "pdf") {
    const styles = StyleSheet.create({
      page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
      title: { fontSize: 16, marginBottom: 4 },
      sub: { fontSize: 9, color: "#666", marginBottom: 16 },
      row: { flexDirection: "row", borderBottom: "1 solid #ddd", paddingVertical: 4 },
      head: { flexDirection: "row", borderBottom: "1.5 solid #333", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
      cRef: { width: "28%" }, cDate: { width: "20%" }, cCol: { width: "22%" }, cQte: { width: "15%", textAlign: "right" }, cPrix: { width: "15%", textAlign: "right" },
      total: { flexDirection: "row", marginTop: 10, fontFamily: "Helvetica-Bold" },
    });
    const el = h(Document, {}, h(Page, { size: "A4", style: styles.page },
      h(Text, { style: styles.title }, `Arrivages — ${produit.nom}`),
      h(Text, { style: styles.sub }, `Édité le ${new Date().toLocaleDateString("fr-FR")} · ${produit.arrivages.length} arrivage(s)`),
      h(View, { style: styles.head },
        h(Text, { style: styles.cRef }, "Référence"),
        h(Text, { style: styles.cDate }, "Date"),
        h(Text, { style: styles.cCol }, "Couleur"),
        h(Text, { style: styles.cQte }, "Quantité"),
        h(Text, { style: styles.cPrix }, "Prix achat"),
      ),
      ...rows.map((r, i) => h(View, { style: styles.row, key: i },
        h(Text, { style: styles.cRef }, r.reference),
        h(Text, { style: styles.cDate }, r.date),
        h(Text, { style: styles.cCol }, r.couleur),
        h(Text, { style: styles.cQte }, String(r.quantite)),
        h(Text, { style: styles.cPrix }, r.prixAchat ? `${r.prixAchat} XAF` : "—"),
      )),
      h(View, { style: styles.total },
        h(Text, { style: styles.cRef }, "TOTAL"),
        h(Text, { style: styles.cDate }, ""),
        h(Text, { style: styles.cCol }, ""),
        h(Text, { style: styles.cQte }, String(totalQte)),
        h(Text, { style: styles.cPrix }, ""),
      ),
    )) as ReactElement<DocumentProps>;

    const buf = await renderToBuffer(el);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="arrivages-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── CSV (Excel) ────────────────────────────────────────────────────────────
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    "Référence;Date;Couleur;Quantité;Prix d'achat (XAF)",
    ...rows.map((r) => [esc(r.reference), esc(r.date), esc(r.couleur), r.quantite, r.prixAchat].join(";")),
    `TOTAL;;;${totalQte};`,
  ];
  const csv = "﻿" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arrivages-${safeName}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
