import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Package, User, Calendar, CreditCard, FileText, Receipt, Eye, ArrowLeft, Clock } from "lucide-react";
import { ShareButton } from "@/components/documents/ShareButton";
import { VenteActionsWrapper } from "./VenteActionsWrapper";
import { VenteEditButton } from "./VenteEditButton";
import { RemboursementCreditButton } from "./RemboursementCreditButton";
import type { Role } from "@prisma/client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const v = await prisma.vente.findUnique({ where: { id }, select: { numero: true } });
  return { title: v?.numero ?? "Vente" };
}

const STATUT_STYLE = {
  COMPLETEE:  { label: "Complétée",  cls: "status-badge status-success" },
  ANNULEE:    { label: "Annulée",    cls: "status-badge status-error"   },
  REMBOURSEE: { label: "Remboursée", cls: "status-badge status-warning" },
} as const;

const PAIEMENT_LABELS: Record<string, string> = {
  ESPECES: "Espèces", CARTE: "Carte bancaire",
  VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte",
};

export default async function VenteDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "ventes:read")) redirect("/dashboard");

  const { id } = await params;

  const [vente, auditLogs, notesVente] = await Promise.all([
    prisma.vente.findUnique({
      where: { id },
      include: {
        client:  true,
        vendeur: { select: { nom: true, prenom: true } },
        lignes: {
          include: {
            produit: {
              select: {
                id: true, nom: true, codeBarres: true, imageUrl: true,
                couleur: true, poids: true, categorie: { select: { nom: true } },
                variantes: { select: { id: true, couleur: true, description: true, stockActuel: true }, orderBy: { couleur: "asc" } },
              },
            },
            variante: { select: { id: true, couleur: true } },
          },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { entityId: id, entityType: "vente" },
      include: { user: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.note.findMany({
      where: { entityId: id, entityType: "vente" },
      include: { auteur: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!vente) notFound();

  // ── Construire la timeline historique ──────────────────────────────────────
  type TLColor = "green" | "amber" | "red" | "gray";
  type TLEvent = { id: string; date: Date; label: string; description?: string; auteur?: string; color: TLColor };

  const ACTION_META: Record<string, { label: string; color: TLColor }> = {
    "vente.created": { label: "Vente créée",    color: "green" },
    "vente.updated": { label: "Vente modifiée", color: "amber" },
    "vente.annulee": { label: "Vente annulée",  color: "red"   },
  };

  const uName = (u?: { nom: string; prenom: string } | null) =>
    u ? `${u.prenom ?? ""} ${u.nom}`.trim() : undefined;

  const timeline: TLEvent[] = [
    ...auditLogs
      .filter(a => a.action in ACTION_META)
      .map(a => {
        const meta = ACTION_META[a.action];
        return {
          id: `audit-${a.id}`, date: a.createdAt,
          label: meta.label, auteur: uName(a.user), color: meta.color,
        };
      }),
    ...notesVente.map(n => ({
      id: `note-${n.id}`, date: n.createdAt,
      label: "Note interne", description: n.contenu,
      auteur: uName(n.auteur), color: "gray" as TLColor,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const DOT_CLS: Record<TLColor, string> = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red:   "bg-red-500",
    gray:  "bg-gray-400",
  };

  const statut = STATUT_STYLE[vente.statut] ?? { label: vente.statut, cls: "status-badge" };
  const canDocs = hasPermission(role, "documents:read");

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/ventes" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Ventes
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium font-mono">{vente.numero}</span>
        <span className={statut.cls}>{statut.label}</span>
      </div>

      {/* Header vente */}
      <div className="card p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Date
            </span>
            <span className="font-medium">{formatDateTime(vente.dateFacture ?? vente.createdAt)}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Client
            </span>
            {vente.client ? (
              <Link href={`/clients/${vente.client.id}`} className="font-medium text-primary hover:underline">
                {vente.client.prenom ? vente.client.prenom + " " : ""}{vente.client.nom}
              </Link>
            ) : (
              <span className="text-muted-foreground italic">Client comptoir</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Vendeur
            </span>
            <span className="font-medium">{vente.vendeur.prenom} {vente.vendeur.nom}</span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Paiement
            </span>
            <span className="font-medium">{PAIEMENT_LABELS[vente.modePaiement] ?? vente.modePaiement}</span>
          </div>
        </div>

        {vente.notes && (
          <p className="mt-4 text-sm text-muted-foreground bg-secondary rounded-lg px-4 py-2.5 italic">
            {vente.notes}
          </p>
        )}
      </div>

      {/* Articles vendus */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Articles vendus</h2>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {vente.lignes.length} article{vente.lignes.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="divide-y divide-border">
          {vente.lignes.map((ligne) => (
            <div key={ligne.id} className="flex gap-4 p-4 hover:bg-secondary/30 transition-colors">
              {/* Image produit */}
              <div className="shrink-0">
                {ligne.produit.imageUrl ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden border bg-muted">
                    <Image
                      src={ligne.produit.imageUrl}
                      alt={ligne.produit.nom}
                      width={56} height={56}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border bg-secondary flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
              </div>

              {/* Infos produit */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/produits/${ligne.produit.id}`}
                    className="font-semibold hover:text-primary transition-colors"
                  >
                    {ligne.produit.nom}
                  </Link>
                  {ligne.produit.couleur && (
                    <span
                      className="w-4 h-4 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: ligne.produit.couleur }}
                    />
                  )}
                  {ligne.produit.categorie && (
                    <span className="status-badge status-info text-xs">{ligne.produit.categorie.nom}</span>
                  )}
                  {ligne.produit.poids && (
                    <span className="text-xs text-muted-foreground">{ligne.produit.poids}</span>
                  )}
                </div>

                {/* Code-barres produit */}
                {ligne.produit.codeBarres && (
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    EAN-13 : {ligne.produit.codeBarres}
                  </p>
                )}

                {/* Prix */}
                <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                  <span className="text-muted-foreground">
                    {ligne.quantite} × {formatCurrency(ligne.prixUnitaire)}
                  </span>
                  {ligne.remise > 0 && (
                    <span className="text-emerald-600 text-xs">−{ligne.remise}%</span>
                  )}
                  <span className="font-bold text-primary ml-auto">{formatCurrency(ligne.total)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="border-t bg-secondary/30 px-5 py-4 space-y-2 text-sm">
          {vente.sousTotal !== vente.total && (
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total</span>
              <span>{formatCurrency(vente.sousTotal)}</span>
            </div>
          )}
          {vente.remiseGlobale > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Remise globale ({vente.remiseGlobale}%)</span>
              <span>−{formatCurrency(vente.sousTotal * vente.remiseGlobale / 100)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span>TOTAL</span>
            <span className="text-primary text-xl">{formatCurrency(vente.total)}</span>
          </div>
        </div>
      </div>

      {/* Actions documents */}
      {canDocs && vente.statut === "COMPLETEE" && (
        <div className="card p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Aperçu reçu HTML */}
            <a href={`/documents/recu/${vente.id}`} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-800 text-center active:scale-[0.98]">
              <Eye className="h-6 w-6" />
              <span className="font-semibold text-sm">Aperçu reçu</span>
              <span className="text-xs opacity-70">Voir + imprimer</span>
            </a>

            {/* Ticket PDF */}
            <div className="flex flex-col gap-2 p-4 rounded-xl border-2 border-amber-200 bg-amber-50 text-amber-800 text-center">
              <Receipt className="h-6 w-6 mx-auto" />
              <span className="font-semibold text-sm">Ticket 80mm</span>
              <div className="flex gap-1.5 justify-center mt-1">
                <a href={`/api/documents/ticket/${vente.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-xs py-1 rounded-lg bg-amber-200 hover:bg-amber-300 transition-colors font-medium">
                  Ouvrir
                </a>
                <ShareButton url={`/api/documents/ticket/${vente.id}`}
                  filename={`ticket-${vente.numero}.pdf`} title={`Ticket ${vente.numero}`}
                  label="Partager" variant="ghost" />
              </div>
            </div>

            {/* Facture PDF */}
            <div className="flex flex-col gap-2 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-800 text-center">
              <FileText className="h-6 w-6 mx-auto" />
              <span className="font-semibold text-sm">Facture A4</span>
              <div className="flex gap-1.5 justify-center mt-1">
                <a href={`/api/documents/facture/${vente.id}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-xs py-1 rounded-lg bg-blue-200 hover:bg-blue-300 transition-colors font-medium">
                  Ouvrir
                </a>
                <ShareButton url={`/api/documents/facture/${vente.id}`}
                  filename={`facture-${vente.numero}.pdf`} title={`Facture ${vente.numero}`}
                  label="Partager" variant="ghost" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modification SUPER_ADMIN */}
      {role === "SUPER_ADMIN" && vente.statut === "COMPLETEE" && (
        <VenteEditButton
          vente={{
            id: vente.id,
            numero: vente.numero,
            clientId: vente.client?.id,
            clientNom: vente.client ? `${vente.client.prenom ?? ""} ${vente.client.nom}`.trim() : undefined,
            modePaiement: vente.modePaiement,
            remiseGlobale: vente.remiseGlobale,
            notes: vente.notes,
            lignes: vente.lignes.map(l => ({
              produitId: l.produit.id,
              varianteId: l.varianteId ?? null,
              couleur: l.variante?.couleur ?? null,
              variantes: l.produit.variantes,
              nom: l.produit.nom,
              prixUnitaire: l.prixUnitaire,
              tauxTVA: l.tauxTVA,
              quantite: l.quantite,
              remise: l.remise,
            })),
          }}
        />
      )}

      {/* Remboursement (règlement) d'une vente à crédit par le client */}
      {vente.statut === "COMPLETEE"
        && vente.modePaiement === "CREDIT" && vente.statutPaiement === "EN_ATTENTE" && (
        <RemboursementCreditButton venteId={vente.id} total={vente.total} montantPaye={vente.montantPaye ?? 0} />
      )}

      {/* Actions vente + demandes */}
      <VenteActionsWrapper
        venteId={vente.id}
        statut={vente.statut}
        role={role}
      />

      {/* ── Historique ── */}
      {timeline.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Historique
          </h2>
          <ol className="relative border-l border-border ml-2 space-y-5">
            {timeline.map((ev) => (
              <li key={ev.id} className="ml-5">
                <span
                  className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${DOT_CLS[ev.color]}`}
                />
                <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">{ev.label}</span>
                  {ev.auteur && (
                    <span className="text-xs text-muted-foreground">par {ev.auteur}</span>
                  )}
                  <time
                    className="text-xs text-muted-foreground ml-auto"
                    dateTime={ev.date.toISOString()}
                  >
                    {formatDateTime(ev.date)}
                  </time>
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                    {ev.description}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
