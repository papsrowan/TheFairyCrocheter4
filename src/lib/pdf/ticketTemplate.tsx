// Ticket de caisse PDF — format reçu 80mm (~226pt)

import {
  Document, Page, Text, View, StyleSheet, Canvas, Image as PDFImage,
} from "@react-pdf/renderer";
import { ean13Bars, code128Bars } from "./barcodeCanvas";
import type { BarRect } from "./barcodeCanvas";
import path from "path";
import fs from "fs";

function getLogoBase64(): string {
  try {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "TFC0.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

const W = 226; // ~80mm en points PDF

const styles = StyleSheet.create({
  page: {
    width: W,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#111",
    backgroundColor: "#fff",
  },
  center: { textAlign: "center" },
  bold:   { fontWeight: "bold" },
  small:  { fontSize: 6.5, color: "#555" },
  divider: { borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: "#ccc", marginVertical: 5 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  total: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 1.5, borderTopColor: "#111" },
});

const MODES: Record<string, string> = {
  ESPECES: "Espèces", CARTE: "Carte", VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte",
};

function fmtXAF(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n).replace(/[   ]/g, " ") + " XAF";
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export interface TicketPDFProps {
  vente: {
    id:           string;
    numero:       string;
    createdAt:    Date | string;
    dateFacture?: Date | string | null;
    sousTotal:    number;
    montantTVA:   number;
    remiseGlobale: number;
    total:        number;
    modePaiement: string;
    notes?:       string | null;
    lignes: Array<{
      id:          string;
      quantite:    number;
      prixUnitaire: number;
      remise:      number;
      total:       number;
      produit:     { nom: string; codeBarres?: string | null };
    }>;
    client?: { nom: string; prenom?: string | null } | null;
    vendeur: { nom: string; prenom: string };
  };
  entreprise: {
    nom:              string;
    adresse:          string;
    codePostal:       string;
    ville:            string;
    telephone?:       string | null;
    piedPageFacture?: string | null;
  };
}

export function TicketPDF({ vente, entreprise }: TicketPDFProps) {
  const logoBase64 = getLogoBase64();
  return (
    <Document title={`Ticket ${vente.numero}`}>
      <Page size={[W, 841]} style={styles.page}>

        {/* En-tête boutique */}
        {logoBase64 ? (
          <PDFImage src={logoBase64} style={{ width: 36, height: 36, alignSelf: "center", marginBottom: 3, objectFit: "contain" }} />
        ) : null}
        <Text style={[styles.center, styles.bold, { fontSize: 11, marginBottom: 2 }]}>
          {entreprise.nom}
        </Text>
        <Text style={[styles.center, styles.small]}>
          {entreprise.adresse}, {entreprise.codePostal} {entreprise.ville}
        </Text>
        {entreprise.telephone && (
          <Text style={[styles.center, styles.small]}>{entreprise.telephone}</Text>
        )}

        <View style={styles.divider} />

        {/* Infos ticket */}
        <View style={styles.row}>
          <Text style={styles.small}>Ticket</Text>
          <Text style={[styles.small, styles.bold]}>{vente.numero}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.small}>Date</Text>
          <Text style={styles.small}>{fmtDate(vente.dateFacture ?? vente.createdAt)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.small}>Vendeur</Text>
          <Text style={styles.small}>{vente.vendeur.prenom} {vente.vendeur.nom}</Text>
        </View>
        {vente.client && (
          <View style={styles.row}>
            <Text style={styles.small}>Client</Text>
            <Text style={styles.small}>
              {vente.client.prenom ? vente.client.prenom + " " : ""}{vente.client.nom}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        {/* Articles */}
        {vente.lignes.map((ligne) => (
          <View key={ligne.id} style={{ marginBottom: 6 }}>
            <Text style={[styles.bold, { fontSize: 7.5 }]}>
              {ligne.produit.nom.length > 35 ? ligne.produit.nom.slice(0, 35) + "…" : ligne.produit.nom}
            </Text>
            <View style={styles.row}>
              <Text style={styles.small}>
                {ligne.quantite} × {fmtXAF(ligne.prixUnitaire)}
                {ligne.remise > 0 ? `  -${ligne.remise}%` : ""}
              </Text>
              <Text style={[styles.small, styles.bold]}>{fmtXAF(ligne.total)}</Text>
            </View>
            {/* Barcode article */}
            {ligne.produit.codeBarres && (
              <View style={{ alignItems: "flex-start", marginTop: 2 }}>
                <Canvas
                  style={{ width: 90, height: 18 }}
                  paint={(p) => {
                    const bars = ean13Bars(ligne.produit.codeBarres!, 90);
                    bars.forEach((b: BarRect) => p.rect(b.x, 0, b.width, 16).fill("#111"));
                    return null;
                  }}
                />
                <Text style={[styles.small, { fontSize: 5.5, marginTop: 1 }]}>
                  {ligne.produit.codeBarres}
                </Text>
              </View>
            )}
          </View>
        ))}

        <View style={styles.divider} />

        {/* Totaux */}
        {vente.sousTotal !== vente.total && (
          <View style={styles.row}>
            <Text style={styles.small}>Sous-total</Text>
            <Text style={styles.small}>{fmtXAF(vente.sousTotal)}</Text>
          </View>
        )}
        {vente.remiseGlobale > 0 && (
          <View style={styles.row}>
            <Text style={[styles.small, { color: "#16a34a" }]}>Remise {vente.remiseGlobale}%</Text>
            <Text style={[styles.small, { color: "#16a34a" }]}>
              -{fmtXAF(vente.sousTotal * vente.remiseGlobale / 100)}
            </Text>
          </View>
        )}
        <View style={styles.total}>
          <Text style={[styles.bold, { fontSize: 10 }]}>TOTAL</Text>
          <Text style={[styles.bold, { fontSize: 10 }]}>{fmtXAF(vente.total)}</Text>
        </View>
        <View style={[styles.row, { marginTop: 3 }]}>
          <Text style={styles.small}>Paiement</Text>
          <Text style={[styles.small, styles.bold]}>{MODES[vente.modePaiement] ?? vente.modePaiement}</Text>
        </View>

        {vente.notes && (
          <Text style={[styles.small, { marginTop: 4 }]}>{vente.notes}</Text>
        )}

        <View style={styles.divider} />

        {/* Barcode ticket */}
        <View style={{ alignItems: "center", marginTop: 4 }}>
          <Canvas
            style={{ width: 180, height: 28 }}
            paint={(p) => {
              const bars = code128Bars(vente.numero, 180);
              bars.forEach((b: BarRect) => p.rect(b.x, 0, b.width, 26).fill("#111"));
              return null;
            }}
          />
          <Text style={[styles.center, styles.bold, { fontSize: 7, marginTop: 2, letterSpacing: 0.8 }]}>
            {vente.numero}
          </Text>
        </View>

        {/* Pied */}
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.center, styles.small]}>
            {entreprise.piedPageFacture ?? "Merci de votre confiance !"}
          </Text>
          <Text style={[styles.center, styles.small, { marginTop: 2 }]}>
            {"Conservez ce ticket comme preuve d'achat"}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
