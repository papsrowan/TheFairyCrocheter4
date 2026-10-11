import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { VenteActions } from "./VenteActions";
import type { Role } from "@prisma/client";

interface Props {
  venteId: string;
  statut: string;
  role: Role;
  numero: string;
  total: number;
  montantPaye: number;
  modePaiement: string;
}

export async function VenteActionsWrapper({
  venteId,
  statut,
  role,
  numero,
  total,
  montantPaye,
  modePaiement,
}: Props) {
  const [demandes, ecritures] = await Promise.all([
    prisma.demandeApprobation.findMany({
      where: { venteId },
      orderBy: { createdAt: "desc" },
      include: { demandeur: { select: { nom: true, prenom: true } } },
    }),
    prisma.ecritureFinanciere.findMany({
      where: { venteId },
      select: { type: true, montant: true },
    }),
  ]);

  const totalRecettes = ecritures
    .filter((e) => e.type === "RECETTE_VENTE")
    .reduce((s, e) => s + e.montant, 0);
  const totalRemboursements = ecritures
    .filter((e) => e.type === "REMBOURSEMENT")
    .reduce((s, e) => s + Math.abs(e.montant), 0);
  const totalEncaisseNet = Math.max(0, totalRecettes - totalRemboursements);

  return (
    <VenteActions
      venteId={venteId}
      numero={numero}
      total={total}
      montantPaye={montantPaye}
      totalEncaisseNet={totalEncaisseNet}
      modePaiement={modePaiement}
      statut={statut}
      canAnnuler={hasPermission(role, "ventes:annuler")}
      isManager={role === "MANAGER"}
      demandes={demandes.map(d => ({
        id:        d.id,
        type:      d.type,
        motif:     d.motif,
        statut:    d.statut,
        reponse:   d.reponse,
        createdAt: d.createdAt.toISOString(),
        demandeur: d.demandeur,
      }))}
    />
  );
}
