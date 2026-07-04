// ─────────────────────────────────────────────────────────────────────────────
// PAGE /commandes-en-ligne — Commandes passées depuis la boutique en ligne
// (base partagée). L'admin valide / refuse / suit les commandes.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { ShoppingCart } from "lucide-react";
import type { Role } from "@prisma/client";
import { CommandeActions } from "./CommandeActions";

export const metadata: Metadata = { title: "Commandes en ligne" };
export const dynamic = "force-dynamic";

const STATUT: Record<string, { label: string; cls: string }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-100 text-amber-800" },
  VALIDEE:    { label: "Validée",    cls: "bg-emerald-100 text-emerald-800" },
  REFUSEE:    { label: "Refusée",    cls: "bg-red-100 text-red-700" },
  EXPEDIEE:   { label: "Expédiée",   cls: "bg-blue-100 text-blue-800" },
  LIVREE:     { label: "Livrée",     cls: "bg-emerald-100 text-emerald-800" },
  ANNULEE:    { label: "Annulée",    cls: "bg-gray-100 text-gray-600" },
};

export default async function CommandesEnLignePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role as Role;
  if (!hasPermission(role, "ventes:read")) redirect("/dashboard");

  const commandes = await prisma.commande.findMany({
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
    include: { lignes: true, compte: { select: { email: true } } },
    take: 100,
  });

  const enAttente = commandes.filter((c) => c.statut === "EN_ATTENTE").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Commandes en ligne
          </h1>
          <p className="text-sm text-muted-foreground">
            {commandes.length} commande(s){enAttente > 0 && ` · ${enAttente} en attente de validation`}
          </p>
        </div>
      </div>

      {commandes.length === 0 ? (
        <div className="card p-12 text-center text-muted-foreground">Aucune commande en ligne pour le moment.</div>
      ) : (
        <div className="space-y-3">
          {commandes.map((c) => {
            const st = STATUT[c.statut] ?? { label: c.statut, cls: "bg-gray-100 text-gray-600" };
            return (
              <div key={c.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-primary">{c.numero}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDateTime(c.createdAt)} · {c.nomClient} · {c.telephone}
                      {c.compte?.email ? ` · ${c.compte.email}` : ""}
                    </p>
                    {c.adresse && <p className="text-sm text-muted-foreground">Adresse : {c.adresse}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(c.total)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                  {c.lignes.map((l) => (
                    <div key={l.id} className="flex justify-between py-0.5">
                      <span>{l.nomProduit}{l.couleur ? ` — ${l.couleur}` : ""} ×{l.quantite}</span>
                      <span className="text-muted-foreground">{formatCurrency(l.prixUnitaire * l.quantite)}</span>
                    </div>
                  ))}
                  {c.note && <p className="mt-2 text-muted-foreground italic">Note : {c.note}</p>}
                </div>

                <div className="mt-3">
                  <CommandeActions commandeId={c.id} statut={c.statut} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
