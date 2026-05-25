import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { VenteActions } from "./VenteActions";
import type { Role } from "@prisma/client";

interface Props { venteId: string; statut: string; role: Role }

export async function VenteActionsWrapper({ venteId, statut, role }: Props) {
  const demandes = await prisma.demandeApprobation.findMany({
    where: { venteId },
    orderBy: { createdAt: "desc" },
    include: { demandeur: { select: { nom: true, prenom: true } } },
  });

  return (
    <VenteActions
      venteId={venteId}
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
