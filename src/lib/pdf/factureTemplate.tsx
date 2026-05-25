// ─────────────────────────────────────────────────────────────────────────────
// PDF — Template de facture avec @react-pdf/renderer
// Généré côté serveur, stocké sur Hostinger
// ─────────────────────────────────────────────────────────────────────────────

import {
  Document, Page, Text, View, StyleSheet, Font, Canvas, Image as PDFImage,
} from "@react-pdf/renderer";
import { ean13Bars, code128Bars } from "./barcodeCanvas";
import type { BarRect } from "./barcodeCanvas";
import path from "path";
import fs from "fs";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    padding: "20mm 15mm",
    backgroundColor: "#ffffff",
  },

  // En-tête
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  logoZone: { width: "50%" },
  companyName: { fontSize: 18, fontWeight: "bold", color: "#1d4ed8", marginBottom: 2 },
  companyInfo: { fontSize: 8, color: "#6b7280", lineHeight: 1.5 },
  invoiceInfo: { width: "45%", alignItems: "flex-end" },
  invoiceTitle: { fontSize: 22, fontWeight: "bold", color: "#1d4ed8", marginBottom: 6 },
  invoiceNumber: { fontSize: 10, fontWeight: "bold", marginBottom: 2 },
  invoiceDate: { fontSize: 8, color: "#6b7280" },

  // Séparateur
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 10 },

  // Client
  clientSection: {
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    padding: "8mm 10mm",
    marginBottom: 16,
  },
  clientLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  clientName: { fontSize: 12, fontWeight: "bold", marginBottom: 2 },
  clientDetail: { fontSize: 9, color: "#374151" },

  // Tableau des articles
  table: { marginBottom: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1d4ed8",
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableRowAlt: { backgroundColor: "#f9fafb" },

  // Colonnes
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "center" },
  colPrice: { flex: 1.5, textAlign: "right" },
  colRemise: { flex: 1, textAlign: "center" },
  colTotal: { flex: 1.5, textAlign: "right" },

  headerText: { color: "#ffffff", fontWeight: "bold", fontSize: 8 },
  cellText: { fontSize: 9, color: "#374151" },
  cellTextBold: { fontSize: 9, fontWeight: "bold" },

  // Totaux
  totalsSection: { alignItems: "flex-end", marginBottom: 20 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: "50%", marginBottom: 3 },
  totalLabel: { fontSize: 9, color: "#6b7280" },
  totalValue: { fontSize: 9, color: "#374151" },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "50%",
    borderTopWidth: 2,
    borderTopColor: "#1d4ed8",
    paddingTop: 5,
    marginTop: 3,
  },
  grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: "#1d4ed8" },
  grandTotalValue: { fontSize: 14, fontWeight: "bold", color: "#1d4ed8" },

  // Pied de page
  footer: {
    position: "absolute",
    bottom: "15mm",
    left: "15mm",
    right: "15mm",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: "#9ca3af", textAlign: "center", lineHeight: 1.5 },
  footerAccent: { color: "#1d4ed8", fontWeight: "bold" },

  // Paiement
  paymentBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  paymentText: { fontSize: 8, color: "#166534", fontWeight: "bold" },
});

export interface FacturePDFProps {
  vente: {
    id: string;
    numero: string;
    createdAt: Date | string;
    sousTotal: number;
    montantTVA: number;
    remiseGlobale: number;
    total: number;
    modePaiement: string;
    notes?: string | null;
    lignes: Array<{
      id: string;
      quantite: number;
      prixUnitaire: number;
      remise: number;
      tauxTVA: number;
      total: number;
      produit: { nom: string; codeBarres?: string | null };
    }>;
    client?: {
      nom: string;
      prenom?: string | null;
      email?: string | null;
      adresse?: string | null;
      codePostal?: string | null;
      ville?: string | null;
    } | null;
  };
  entreprise: {
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    telephone?: string | null;
    email?: string | null;
    siteWeb?: string | null;
    siret?: string | null;
    tauxTVADefaut: number;
    mentionsLegales?: string | null;
    piedPageFacture?: string | null;
  };
}

function getLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), "public", "TFC0.png");
    const buf = fs.readFileSync(logoPath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const MODES_PAIEMENT: Record<string, string> = {
  ESPECES: "Espèces",
  CARTE: "Carte bancaire",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  MIXTE: "Paiement mixte",
};

function formatCurrencyPDF(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " XAF";
}

function formatDatePDF(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function FacturePDF({ vente, entreprise }: FacturePDFProps) {
  const logoBase64 = getLogoBase64();
  return (
    <Document
      title={`Facture ${vente.numero}`}
      author={entreprise.nom}
      subject={`Facture ${vente.numero}`}
      creator="Gestion Commerciale"
    >
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.logoZone}>
            {logoBase64 ? (
              <PDFImage src={logoBase64} style={{ width: 48, height: 48, marginBottom: 4, objectFit: "contain" }} />
            ) : null}
            <Text style={styles.companyName}>{entreprise.nom}</Text>
            <Text style={styles.companyInfo}>
              {entreprise.adresse}{"\n"}
              {entreprise.codePostal} {entreprise.ville}
              {entreprise.telephone ? `\n${entreprise.telephone}` : ""}
              {entreprise.email ? `\n${entreprise.email}` : ""}
              {entreprise.siret ? `\nSIRET : ${entreprise.siret}` : ""}
            </Text>
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceNumber}>{vente.numero}</Text>
            <Text style={styles.invoiceDate}>
              Émise le {formatDatePDF(vente.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Informations client */}
        {vente.client && (
          <View style={styles.clientSection}>
            <Text style={styles.clientLabel}>Facturé à</Text>
            <Text style={styles.clientName}>
              {vente.client.prenom ? `${vente.client.prenom} ` : ""}{vente.client.nom}
            </Text>
            {vente.client.email && (
              <Text style={styles.clientDetail}>{vente.client.email}</Text>
            )}
            {vente.client.adresse && (
              <Text style={styles.clientDetail}>
                {vente.client.adresse}
                {vente.client.codePostal
                  ? `, ${vente.client.codePostal} ${vente.client.ville ?? ""}`
                  : ""}
              </Text>
            )}
          </View>
        )}

        {/* Mode de paiement */}
        <View style={styles.paymentBadge}>
          <Text style={styles.paymentText}>
            ✓ {MODES_PAIEMENT[vente.modePaiement] ?? vente.modePaiement}
          </Text>
        </View>

        {/* Tableau des articles */}
        <View style={styles.table}>
          {/* En-tête tableau */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDescription]}>Description</Text>
            <Text style={[styles.headerText, styles.colQty]}>Qté</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Prix U. HT</Text>
            <Text style={[styles.headerText, styles.colRemise]}>Remise</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Total TTC</Text>
          </View>

          {/* Lignes */}
          {vente.lignes.map((ligne, index) => (
            <View
              key={ligne.id}
              style={[styles.tableRow, index % 2 !== 0 ? styles.tableRowAlt : {}]}
            >
              <View style={styles.colDescription}>
                <Text style={styles.cellTextBold}>{ligne.produit.nom}</Text>
                {ligne.produit.codeBarres && (
                  <>
                    <Canvas
                      style={{ width: 80, height: 20, marginTop: 2 }}
                      paint={(p) => {
                        const bars = ean13Bars(ligne.produit.codeBarres!, 80);
                        bars.forEach((b: BarRect) => {
                          p.rect(b.x, 0, b.width, 18).fill("#111827");
                        });
                        return null;
                      }}
                    />
                    <Text style={{ fontSize: 6, color: "#6b7280", fontFamily: "Helvetica", marginTop: 1 }}>
                      {ligne.produit.codeBarres}
                    </Text>
                  </>
                )}
                <Text style={[styles.cellText, { color: "#9ca3af", fontSize: 7, marginTop: 2 }]}>
                  TVA {ligne.tauxTVA}%
                </Text>
              </View>
              <Text style={[styles.cellText, styles.colQty]}>{ligne.quantite}</Text>
              <Text style={[styles.cellText, styles.colPrice]}>
                {formatCurrencyPDF(ligne.prixUnitaire / (1 + ligne.tauxTVA / 100))}
              </Text>
              <Text style={[styles.cellText, styles.colRemise]}>
                {ligne.remise > 0 ? `${ligne.remise}%` : "—"}
              </Text>
              <Text style={[styles.cellTextBold, styles.colTotal]}>
                {formatCurrencyPDF(ligne.total)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total HT</Text>
            <Text style={styles.totalValue}>
              {formatCurrencyPDF(vente.sousTotal - vente.montantTVA)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA</Text>
            <Text style={styles.totalValue}>{formatCurrencyPDF(vente.montantTVA)}</Text>
          </View>
          {vente.remiseGlobale > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: "#16a34a" }]}>
                Remise globale ({vente.remiseGlobale}%)
              </Text>
              <Text style={[styles.totalValue, { color: "#16a34a" }]}>
                − {formatCurrencyPDF(vente.sousTotal * vente.remiseGlobale / 100)}
              </Text>
            </View>
          )}
          {(() => {
            const totalCalcule = Math.round(vente.sousTotal * (1 - vente.remiseGlobale / 100) * 100) / 100;
            const prixSpecialApplique = Math.abs(vente.total - totalCalcule) > 0.5;
            if (!prixSpecialApplique) return null;
            return (
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: "#d97706" }]}>Prix spécial accordé</Text>
                <Text style={[styles.totalValue, { color: "#d97706" }]}>
                  − {formatCurrencyPDF(totalCalcule - vente.total)}
                </Text>
              </View>
            );
          })()}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
            <Text style={styles.grandTotalValue}>{formatCurrencyPDF(vente.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {vente.notes && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 3 }}>Notes :</Text>
            <Text style={{ fontSize: 9, color: "#374151" }}>{vente.notes}</Text>
          </View>
        )}

        {/* Barcode de la facture */}
        <View style={{ alignItems: "center", marginBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f3f4f6" }}>
          <Text style={{ fontSize: 7, color: "#9ca3af", marginBottom: 4 }}>
            Référence de la facture (scan pour vérification)
          </Text>
          <Canvas
            style={{ width: 160, height: 30 }}
            paint={(p) => {
              const bars = code128Bars(vente.numero, 160);
              bars.forEach((b: BarRect) => {
                p.rect(b.x, 0, b.width, 28).fill("#111827");
              });
              return null;
            }}
          />
          <Text style={{ fontSize: 8, fontFamily: "Helvetica", fontWeight: "bold", marginTop: 2, letterSpacing: 1 }}>
            {vente.numero}
          </Text>
        </View>

        {/* Pied de page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            <Text style={styles.footerAccent}>{entreprise.nom}</Text>
            {entreprise.mentionsLegales
              ? ` — ${entreprise.mentionsLegales}`
              : ` — ${entreprise.adresse}, ${entreprise.codePostal} ${entreprise.ville}`}
            {"\n"}
            {entreprise.piedPageFacture ?? "Merci de votre confiance."}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
