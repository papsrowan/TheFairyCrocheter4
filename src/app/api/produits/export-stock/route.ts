// ─────────────────────────────────────────────────────────────────────────────
// GET /api/produits/export-stock?format=csv|pdf&date=YYYY-MM-DD
// Exporte l'état du stock actuel ou rétroactif à une date précise
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "produits:read")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "csv";
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  let targetDate: Date | null = null;
  if (dateStr) {
    const d = new Date(`${dateStr}T23:59:59.999Z`);
    if (!isNaN(d.getTime())) {
      targetDate = d;
    }
  }

  // 1. Récupérer tous les produits et leurs variantes
  const produits = await prisma.produit.findMany({
    where: { actif: true },
    include: {
      categorie: true,
      variantes: true,
    },
    orderBy: { nom: "asc" },
  });

  // 2. Si une date cible est spécifiée, calculer les deltas de mouvement postérieurs à la date
  const deltasProduitMap = new Map<string, number>();
  const deltasVarianteMap = new Map<string, number>();

  if (targetDate) {
    const mouvementsPosterieurs = await prisma.mouvementStock.findMany({
      where: {
        createdAt: { gt: targetDate },
      },
      select: {
        produitId: true,
        varianteId: true,
        stockAvant: true,
        stockApres: true,
      },
    });

    for (const m of mouvementsPosterieurs) {
      const delta = m.stockApres - m.stockAvant;
      if (m.varianteId) {
        const prev = deltasVarianteMap.get(m.varianteId) ?? 0;
        deltasVarianteMap.set(m.varianteId, prev + delta);
      } else {
        const prev = deltasProduitMap.get(m.produitId) ?? 0;
        deltasProduitMap.set(m.produitId, prev + delta);
      }
    }
  }

  // 3. Construire les lignes pour le rapport
  const rows: Array<{
    produitNom: string;
    codeBarres: string;
    categorie: string;
    couleur: string;
    description: string;
    stock: number;
    prixAchat: number;
    prixVente: number;
    valeurAchat: number;
  }> = [];

  for (const p of produits) {
    const catNom = p.categorie?.nom ?? "—";

    if (p.variantes && p.variantes.length > 0) {
      for (const v of p.variantes) {
        const delta = deltasVarianteMap.get(v.id) ?? 0;
        const stockAdate = Math.max(0, v.stockActuel - delta);

        rows.push({
          produitNom: p.nom,
          codeBarres: v.codeBarres ?? p.codeBarres ?? "—",
          categorie: catNom,
          couleur: v.couleur,
          description: v.description ?? "—",
          stock: stockAdate,
          prixAchat: p.prixAchat,
          prixVente: p.prixVente,
          valeurAchat: stockAdate * p.prixAchat,
        });
      }
    } else {
      const delta = deltasProduitMap.get(p.id) ?? 0;
      const stockAdate = Math.max(0, p.stockActuel - delta);

      rows.push({
        produitNom: p.nom,
        codeBarres: p.codeBarres ?? "—",
        categorie: catNom,
        couleur: p.couleur ?? "—",
        description: p.description ?? "—",
        stock: stockAdate,
        prixAchat: p.prixAchat,
        prixVente: p.prixVente,
        valeurAchat: stockAdate * p.prixAchat,
      });
    }
  }

  const totalStock = rows.reduce((s, r) => s + r.stock, 0);
  const totalValeurAchat = rows.reduce((s, r) => s + r.valeurAchat, 0);
  const dateFormatted = targetDate
    ? new Date(targetDate).toLocaleDateString("fr-FR")
    : new Date().toLocaleDateString("fr-FR");

  const filenameDate = targetDate ? dateStr : new Date().toISOString().slice(0, 10);

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (format === "pdf") {
    const styles = StyleSheet.create({
      page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
      header: { marginBottom: 12 },
      title: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 2 },
      sub: { fontSize: 8, color: "#555" },
      head: {
        flexDirection: "row",
        borderBottom: "1.5 solid #333",
        paddingVertical: 4,
        fontFamily: "Helvetica-Bold",
        backgroundColor: "#f3f4f6",
      },
      row: { flexDirection: "row", borderBottom: "1 solid #eee", paddingVertical: 3 },
      cNom: { width: "22%" },
      cCat: { width: "12%" },
      cCol: { width: "12%" },
      cDesc: { width: "22%" },
      cStock: { width: "10%", textAlign: "right" },
      cPrix: { width: "11%", textAlign: "right" },
      cVal: { width: "11%", textAlign: "right" },
      total: { flexDirection: "row", marginTop: 8, paddingTop: 4, borderTop: "1.5 solid #333", fontFamily: "Helvetica-Bold" },
    });

    const el = h(
      Document,
      {},
      h(
        Page,
        { size: "A4", orientation: "landscape", style: styles.page },
        h(
          View,
          { style: styles.header },
          h(Text, { style: styles.title }, `État des Stocks${targetDate ? ` au ${dateFormatted}` : " (Actuel)"}`),
          h(Text, { style: styles.sub }, `Édité le ${new Date().toLocaleDateString("fr-FR")} · ${rows.length} référence(s)`)
        ),
        h(
          View,
          { style: styles.head },
          h(Text, { style: styles.cNom }, "Produit"),
          h(Text, { style: styles.cCat }, "Catégorie"),
          h(Text, { style: styles.cCol }, "Couleur"),
          h(Text, { style: styles.cDesc }, "Description couleur"),
          h(Text, { style: styles.cStock }, "Stock"),
          h(Text, { style: styles.cPrix }, "Prix Achat"),
          h(Text, { style: styles.cVal }, "Valeur Achat")
        ),
        ...rows.map((r, i) =>
          h(
            View,
            { style: styles.row, key: i },
            h(Text, { style: styles.cNom }, r.produitNom),
            h(Text, { style: styles.cCat }, r.categorie),
            h(Text, { style: styles.cCol }, r.couleur),
            h(Text, { style: styles.cDesc }, r.description),
            h(Text, { style: styles.cStock }, String(r.stock)),
            h(Text, { style: styles.cPrix }, `${r.prixAchat} XAF`),
            h(Text, { style: styles.cVal }, `${r.valeurAchat} XAF`)
          )
        ),
        h(
          View,
          { style: styles.total },
          h(Text, { style: styles.cNom }, "TOTAL"),
          h(Text, { style: styles.cCat }, ""),
          h(Text, { style: styles.cCol }, ""),
          h(Text, { style: styles.cDesc }, ""),
          h(Text, { style: styles.cStock }, String(totalStock)),
          h(Text, { style: styles.cPrix }, ""),
          h(Text, { style: styles.cVal }, `${totalValeurAchat} XAF`)
        )
      )
    ) as ReactElement<DocumentProps>;

    const buf = await renderToBuffer(el);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="stock-${filenameDate}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // ── CSV (Excel) ────────────────────────────────────────────────────────────
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    "Produit;Code-barres;Catégorie;Couleur;Description couleur;Stock;Prix d'achat (XAF);Prix de vente (XAF);Valeur d'achat totale (XAF)",
    ...rows.map((r) =>
      [
        esc(r.produitNom),
        esc(r.codeBarres),
        esc(r.categorie),
        esc(r.couleur),
        esc(r.description),
        r.stock,
        r.prixAchat,
        r.prixVente,
        r.valeurAchat,
      ].join(";")
    ),
    `TOTAL;;;;;${totalStock};;;${totalValeurAchat}`,
  ];
  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-${filenameDate}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
