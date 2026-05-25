"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REÇU THERMIQUE — Format 80mm, impression navigateur
// Appelé via window.print() depuis la caisse après validation
// ─────────────────────────────────────────────────────────────────────────────

import { formatCurrency, formatDateTime } from "@/lib/utils/format";

interface RecuProps {
  vente: {
    numero: string;
    createdAt: Date | string;
    total: number;
    sousTotal: number;
    montantTVA: number;
    remiseGlobale: number;
    modePaiement: string;
    notes?: string | null;
    lignes: Array<{
      quantite: number;
      prixUnitaire: number;
      remise: number;
      total: number;
      produit: { nom: string };
    }>;
    client?: { nom: string; prenom?: string | null } | null;
    vendeur?: { nom: string; prenom?: string | null } | null;
  };
  entreprise?: {
    nom: string;
    adresse: string;
    codePostal: string;
    ville: string;
    telephone?: string | null;
    siret?: string | null;
  } | null;
}

const MODES_PAIEMENT: Record<string, string> = {
  ESPECES: "Espèces",
  CARTE: "Carte bancaire",
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  MIXTE: "Mixte",
};

export function RecuThermique({ vente, entreprise }: RecuProps) {
  const separator = "─".repeat(32);

  return (
    <div className="thermal-receipt no-screen">
      {/* En-tête */}
      <div className="text-center mb-2">
        <p className="font-bold text-sm">{entreprise?.nom ?? "MON COMMERCE"}</p>
        {entreprise && (
          <>
            <p>{entreprise.adresse}</p>
            <p>{entreprise.codePostal} {entreprise.ville}</p>
            {entreprise.telephone && <p>{entreprise.telephone}</p>}
          </>
        )}
      </div>

      <div className="separator" />

      {/* Numéro et date */}
      <div className="mb-1">
        <p className="font-bold">REÇU N° {vente.numero}</p>
        <p>{formatDateTime(vente.createdAt)}</p>
        {vente.client && (
          <p>Client : {vente.client.prenom ?? ""} {vente.client.nom}</p>
        )}
        {vente.vendeur && (
          <p>Caissier : {vente.vendeur.prenom ?? ""} {vente.vendeur.nom}</p>
        )}
      </div>

      <div className="separator" />

      {/* Articles */}
      {vente.lignes.map((ligne, i) => (
        <div key={i} className="mb-1">
          <p className="font-bold truncate">{ligne.produit.nom}</p>
          <div className="flex justify-between">
            <span>
              {ligne.quantite} × {formatCurrency(ligne.prixUnitaire)}
              {ligne.remise > 0 && ` (−${ligne.remise}%)`}
            </span>
            <span className="font-bold">{formatCurrency(ligne.total)}</span>
          </div>
        </div>
      ))}

      <div className="separator" />

      {/* Totaux */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Sous-total HT</span>
          <span>{formatCurrency(vente.sousTotal - vente.montantTVA)}</span>
        </div>
        <div className="flex justify-between">
          <span>TVA</span>
          <span>{formatCurrency(vente.montantTVA)}</span>
        </div>
        {vente.remiseGlobale > 0 && (
          <div className="flex justify-between">
            <span>Remise {vente.remiseGlobale}%</span>
            <span>−{formatCurrency(vente.sousTotal * vente.remiseGlobale / 100)}</span>
          </div>
        )}
        <div className="separator" />
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL TTC</span>
          <span>{formatCurrency(vente.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>Règlement</span>
          <span>{MODES_PAIEMENT[vente.modePaiement] ?? vente.modePaiement}</span>
        </div>
      </div>

      {/* Notes */}
      {vente.notes && (
        <>
          <div className="separator" />
          <p className="text-xs">{vente.notes}</p>
        </>
      )}

      <div className="separator" />

      {/* Pied de page */}
      <div className="text-center mt-2">
        <p>Merci de votre visite !</p>
        {entreprise?.siret && <p className="text-xs">SIRET : {entreprise.siret}</p>}
        <p className="text-xs mt-1">Conservez ce reçu</p>
      </div>

      {/* Espace de coupe */}
      <div style={{ marginTop: "20mm" }} />
    </div>
  );
}

// Styles CSS d'impression (injectés dans globals.css via @media print)
// Voir src/app/globals.css section PRINT
