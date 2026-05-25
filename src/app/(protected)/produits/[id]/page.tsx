import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/security/rbac";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import ProduitForm from "@/components/produits/ProduitForm";
import ProduitDetailClient from "@/components/produits/ProduitDetailClient";
import MouvementsStockTable from "@/components/produits/MouvementsStockTable";
import { BarcodeDisplay } from "@/components/produits/BarcodeDisplay";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Package, TrendingUp, ShoppingCart, AlertTriangle } from "lucide-react";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.produit.findUnique({ where: { id }, select: { nom: true } });
  return { title: p?.nom ?? "Produit" };
}

export default async function ProduitDetailPage({ params }: Params) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (!hasPermission(role, "produits:read")) redirect("/dashboard");

  const { id } = await params;

  const [produit, categories] = await Promise.all([
    prisma.produit.findUnique({
      where: { id },
      include: {
        categorie: true,
        variantes: { orderBy: { couleur: "asc" } },
        mouvementsStock: {
          orderBy: { createdAt: "asc" },
          take: 500,
        },
        _count: { select: { lignesVente: true } },
      },
    }),
    prisma.categorie.findMany({ orderBy: { nom: "asc" } }),
  ]);

  if (!produit) notFound();

  const canEdit   = hasPermission(role, "produits:update");
  const canDelete = hasPermission(role, "produits:delete");
  const enAlerte  = produit.stockActuel < produit.stockMinimum;

  // Calculs stats
  const totalEntrees = produit.mouvementsStock
    .filter((m) => m.type === "ENTREE")
    .reduce((s, m) => s + m.quantite, 0);
  const totalSorties = produit.mouvementsStock
    .filter((m) => m.type.startsWith("SORTIE"))
    .reduce((s, m) => s + m.quantite, 0);

  const margePercent = produit.prixAchat > 0
    ? ((produit.prixVente - produit.prixAchat) / produit.prixVente * 100).toFixed(1)
    : null;

  const initialData = {
    id:             produit.id,
    nom:            produit.nom,
    description:    produit.description  ?? "",
    categorieId:    produit.categorieId  ?? "",
    prixVente:      String(produit.prixVente),
    prixGros:       produit.prixGros     ? String(produit.prixGros)     : "",
    qtePrixGros:    produit.qtePrixGros  ? String(produit.qtePrixGros)  : "",
    prixAchat:      String(produit.prixAchat),
    stockActuel:    String(produit.stockActuel),
    stockMinimum:   String(produit.stockMinimum),
    imageUrl:       produit.imageUrl     ?? "",
    poids:          produit.poids        ?? "",
    dateAcquisition: produit.dateAcquisition
      ? produit.dateAcquisition.toISOString().slice(0, 10) : "",
    variantes: produit.variantes.map((v) => ({
      id:          v.id,
      couleur:     v.couleur,
      stockActuel: v.stockActuel,
    })),
  };

  const mouvements = produit.mouvementsStock.map((m) => ({
    id:         m.id,
    type:       m.type,
    quantite:   m.quantite,
    stockAvant: m.stockAvant,
    stockApres: m.stockApres,
    motif:      m.motif,
    venteId:    m.venteId,
    createdAt:  m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Fil d'Ariane */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/produits" className="hover:text-foreground transition-colors">← Produits</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{produit.nom}</span>
        {!produit.actif && <span className="status-badge bg-muted text-muted-foreground">Archivé</span>}
      </div>

      {/* Header produit */}
      <div className="card p-5">
        <div className="flex gap-5 flex-wrap">
          {/* Image */}
          <div className="shrink-0">
            {produit.imageUrl ? (
              <div className="w-28 h-28 rounded-2xl overflow-hidden border bg-muted">
                <Image src={produit.imageUrl} alt={produit.nom} width={112} height={112} className="object-cover w-full h-full" />
              </div>
            ) : (
              <div className="w-28 h-28 rounded-2xl border bg-secondary flex items-center justify-center">
                <Package className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Infos principales */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{produit.nom}</h1>
              {produit.variantes.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  {produit.variantes.slice(0, 6).map((v) => (
                    <span key={v.id} className="w-4 h-4 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: v.couleur }} title={v.couleur} />
                  ))}
                  {produit.variantes.length > 6 && (
                    <span className="text-xs text-muted-foreground">+{produit.variantes.length - 6}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              {produit.categorie && (
                <span className="status-badge status-info">{produit.categorie.nom}</span>
              )}
              {produit.poids && (
                <span className="status-badge bg-secondary text-secondary-foreground">{produit.poids}</span>
              )}
              {enAlerte && (
                <span className="status-badge status-error flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Stock critique
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Prix détail</span>
                <p className="font-bold text-primary text-lg">{formatCurrency(produit.prixVente)}</p>
              </div>
              {produit.prixGros && (
                <div>
                  <span className="text-muted-foreground">Prix gros {produit.qtePrixGros ? `(≥${produit.qtePrixGros})` : ""}</span>
                  <p className="font-semibold">{formatCurrency(produit.prixGros)}</p>
                </div>
              )}
              {margePercent && (
                <div>
                  <span className="text-muted-foreground">Marge</span>
                  <p className="font-semibold text-emerald-600">{margePercent}%</p>
                </div>
              )}
              {produit.dateAcquisition && (
                <div>
                  <span className="text-muted-foreground">Acquisition</span>
                  <p className="font-medium">{formatDate(produit.dateAcquisition)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Package,      label: "Stock actuel",   value: produit.stockActuel,          sub: `min ${produit.stockMinimum}`,       alert: enAlerte },
          { icon: TrendingUp,   label: "Total entrées",  value: totalEntrees,                  sub: "unités reçues",                     alert: false },
          { icon: ShoppingCart, label: "Total sorties",  value: totalSorties,                  sub: "unités vendues",                    alert: false },
          { icon: ShoppingCart, label: "Lignes de vente",value: produit._count.lignesVente,    sub: "transactions",                      alert: false },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className={cn("h-4 w-4", s.alert ? "text-destructive" : "text-primary")} />
            </div>
            <p className={cn("text-2xl font-bold", s.alert && "text-destructive")}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Couleurs & stock par couleur ── */}
      {produit.variantes.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Couleurs disponibles</h2>
            <span className="text-xs text-muted-foreground">
              Total : <span className="font-bold text-foreground">{produit.variantes.reduce((s, v) => s + v.stockActuel, 0)} unités</span>
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {produit.variantes.map((v) => {
              const rupture = v.stockActuel <= 0;
              return (
                <div key={v.id} className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border",
                  rupture ? "opacity-50 border-dashed" : "border-border"
                )}>
                  <span
                    className="w-8 h-8 rounded-full border-2 border-white shadow shrink-0"
                    style={{ backgroundColor: v.couleur }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.couleur}</p>
                    <p className={cn("text-xs font-bold", rupture ? "text-destructive" : "text-primary")}>
                      {rupture ? "Rupture" : `${v.stockActuel} unités`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire / Infos */}
        <div className="lg:col-span-2 space-y-4">
          {canEdit ? (
            <>
              <h2 className="font-semibold">Modifier le produit</h2>
              <ProduitForm categories={categories} initialData={initialData} mode="edit" />
            </>
          ) : (
            <div className="card p-5 space-y-3">
              <h2 className="font-semibold">Informations produit</h2>
              <dl className="space-y-2 text-sm divide-y divide-border">
                {[
                  ["Catégorie",       produit.categorie?.nom ?? "—"],
                  ["Poids",           produit.poids ?? "—"],
                  ["Couleur",         produit.couleur ?? "—"],
                  ["Prix détail",     formatCurrency(produit.prixVente)],
                  ["Prix de gros",    produit.prixGros ? formatCurrency(produit.prixGros) : "—"],
                  ["Prix d'achat",    formatCurrency(produit.prixAchat)],
                  ["Description",     produit.description ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium max-w-xs text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* Panneau latéral */}
        <div className="space-y-4">
          {/* Barcode */}
          {produit.codeBarres && (
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-sm">Code-barres</h3>
              <BarcodeDisplay value={produit.codeBarres} nom={produit.nom} />
            </div>
          )}

          <ProduitDetailClient
            produitId={produit.id}
            produitNom={produit.nom}
            stockActuel={produit.stockActuel}
            stockMinimum={produit.stockMinimum}
            actif={produit.actif}
            canStock={canEdit}
            canDelete={canDelete}
            isSuperAdmin={role === "SUPER_ADMIN"}
          />
        </div>
      </div>

      {/* Historique mouvements */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Historique des mouvements de stock</h2>
          <span className="text-xs text-muted-foreground">{mouvements.length} mouvements</span>
        </div>
        <MouvementsStockTable mouvements={mouvements} />
      </div>
    </div>
  );
}
