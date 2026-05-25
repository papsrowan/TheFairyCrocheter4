// ─────────────────────────────────────────────────────────────────────────────
// PAGE /clients/[id] — Fiche client complète
// Server Component — détail + ventes + notes
// ─────────────────────────────────────────────────────────────────────────────

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect, notFound } from "next/navigation";
import type { Role } from "@prisma/client";
import Link from "next/link";
import { ClientForm } from "@/components/clients/ClientForm";
import { ClientDetailClient } from "@/components/clients/ClientDetailClient";
import { VentesHistoriqueTable } from "@/components/clients/VentesHistoriqueTable";
import { NotesSection } from "@/components/clients/NotesSection";

type Params = { params: Promise<{ id: string }> };

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " XAF";
}

function formatDate(d: Date | null | string) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default async function ClientDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "clients:read")) redirect("/dashboard");
  // MANAGER : accès aux fiches client interdit
  if (!hasPermission(role, "clients:details")) redirect("/clients");

  const { id } = await params;

  const [client, categories, notes] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        categorie: true,
        ventes: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id:           true,
            numero:       true,
            total:        true,
            modePaiement: true,
            statut:       true,
            createdAt:    true,
            vendeur: { select: { nom: true, prenom: true } },
            lignes: { select: { produit: { select: { nom: true } } } },
          },
        },
        _count: { select: { ventes: true } },
      },
    }),
    prisma.categorieClient.findMany({ orderBy: { nom: "asc" } }),
    prisma.note.findMany({
      where: { entityId: id, entityType: "client" },
      include: { auteur: { select: { id: true, nom: true, prenom: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!client) notFound();

  const canEdit   = hasPermission(role, "clients:update");
  const canRGPD   = hasPermission(role, "clients:rgpd");
  const canDelete = hasPermission(role, "clients:delete");
  const canNotes  = hasPermission(role, "notes:create");

  const estAnonyme = !!client.anonymiseLe;

  // Sérialiser les dates pour les composants client
  const ventesSerialises = client.ventes.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  }));
  const notesSerialises = notes.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link href="/clients" className="text-gray-400 hover:text-gray-600 transition-colors" title="Retour">
          ←
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {estAnonyme
                ? "Client anonymisé"
                : client.prenom
                ? `${client.prenom} ${client.nom}`
                : client.nom}
            </h1>
            {estAnonyme && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                RGPD — anonymisé le {formatDate(client.anonymiseLe)}
              </span>
            )}
            {client.categorie && (
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                {client.categorie.nom}
                {client.categorie.remise > 0 && ` (−${client.categorie.remise}%)`}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Client depuis le {formatDate(client.createdAt)}
          </p>
        </div>
      </div>

      {/* ── Statistiques rapides ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total achats</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatMontant(client.totalAchats)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Nb. ventes</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{client._count.ventes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Dernier achat</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatDate(client.dernierAchat)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Panier moyen</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {client._count.ventes > 0
              ? formatMontant(client.totalAchats / client._count.ventes)
              : "—"}
          </p>
        </div>
      </div>

      {/* ── Corps : formulaire + sidebar ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire d'édition */}
        <div className="lg:col-span-2">
          {estAnonyme ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
              <p className="font-medium">Données personnelles supprimées</p>
              <p className="text-sm mt-1">
                Conformément au RGPD, les informations de ce client ont été anonymisées le{" "}
                {formatDate(client.anonymiseLe)}.
              </p>
            </div>
          ) : (
            <ClientForm
              mode="edit"
              clientId={id}
              defaultValues={{
                nom:              client.nom,
                prenom:           client.prenom ?? undefined,
                email:            client.email ?? undefined,
                telephone:        client.telephone ?? undefined,
                adresse:          client.adresse ?? undefined,
                codePostal:       client.codePostal ?? undefined,
                ville:            client.ville ?? undefined,
                categorieId:      client.categorieId ?? undefined,
                consentementRGPD: client.consentementRGPD,
              }}
              categories={categories}
              canEdit={canEdit}
            />
          )}
        </div>

        {/* Sidebar : actions + RGPD */}
        <div>
          <ClientDetailClient
            clientId={id}
            nomClient={client.prenom ? `${client.prenom} ${client.nom}` : client.nom}
            email={client.email}
            telephone={client.telephone}
            consentementRGPD={client.consentementRGPD}
            consentementDate={client.consentementDate?.toISOString() ?? null}
            estAnonyme={estAnonyme}
            anonymiseLe={client.anonymiseLe?.toISOString() ?? null}
            canRGPD={canRGPD}
            canDelete={canDelete}
            nbVentes={client._count.ventes}
          />
        </div>
      </div>

      {/* ── Historique des ventes ─────────────────────────────────────── */}
      {client._count.ventes > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">
              Historique des achats
              <span className="ml-2 text-sm text-gray-400 font-normal">
                (20 derniers sur {client._count.ventes})
              </span>
            </h2>
          </div>
          <VentesHistoriqueTable ventes={ventesSerialises} />
        </div>
      )}

      {/* ── Notes internes ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Notes internes</h2>
        </div>
        <div className="p-5">
          <NotesSection
            clientId={id}
            notes={notesSerialises}
            currentUserId={session.user.id}
            currentUserRole={role}
            canCreate={canNotes && !estAnonyme}
          />
        </div>
      </div>
    </div>
  );
}
