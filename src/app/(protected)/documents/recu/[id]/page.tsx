import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { RecuClient } from "./RecuClient";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function RecuPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [vente, entreprise] = await Promise.all([
    prisma.vente.findUnique({
      where: { id },
      include: {
        client:  { select: { nom: true, prenom: true } },
        vendeur: { select: { nom: true, prenom: true } },
        lignes: {
          include: { produit: { select: { nom: true, codeBarres: true } } },
        },
      },
    }),
    prisma.entreprise.findFirst(),
  ]);

  if (!vente) notFound();

  const ent = entreprise ?? {
    nom: "The Fairy Crocheter", adresse: "", codePostal: "", ville: "",
    telephone: null, piedPageFacture: "Merci de votre confiance.",
  };

  const data = {
    vente: {
      id:            vente.id,
      numero:        vente.numero,
      createdAt:     vente.createdAt.toISOString(),
      sousTotal:     vente.sousTotal,
      montantTVA:    vente.montantTVA,
      remiseGlobale: vente.remiseGlobale,
      total:         vente.total,
      modePaiement:  vente.modePaiement,
      notes:         vente.notes,
      client:        vente.client,
      vendeur:       vente.vendeur,
      lignes:        vente.lignes,
    },
    entreprise: {
      nom:              ent.nom,
      adresse:          ent.adresse ?? "",
      codePostal:       ent.codePostal ?? "",
      ville:            ent.ville ?? "",
      telephone:        ent.telephone ?? null,
      piedPageFacture:  ent.piedPageFacture ?? "Merci de votre confiance !",
    },
  };

  return <RecuClient data={data} />;
}
