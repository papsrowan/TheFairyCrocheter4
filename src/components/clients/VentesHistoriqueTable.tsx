"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type StatutVente  = "COMPLETEE" | "ANNULEE" | "REMBOURSEE";
type ModePaiement = "ESPECES" | "CARTE" | "VIREMENT" | "CHEQUE" | "MIXTE" | "CREDIT";

interface LigneProduit { produit: { nom: string } }
interface VenteRow {
  id:           string;
  numero:       string;
  total:        number;
  modePaiement: ModePaiement;
  statut:       StatutVente;
  createdAt:    string;
  vendeur:      { nom: string; prenom: string };
  lignes?:      LigneProduit[];
}

interface Props { ventes: VenteRow[] }

const STATUT_LABELS: Record<StatutVente, { label: string; classes: string }> = {
  COMPLETEE:  { label: "Complétée",  classes: "status-badge status-badge-success" },
  ANNULEE:    { label: "Annulée",    classes: "status-badge status-badge-danger"  },
  REMBOURSEE: { label: "Remboursée", classes: "status-badge status-badge-warning" },
};

const MODE_LABELS: Record<ModePaiement, string> = {
  ESPECES: "Espèces", CARTE: "Carte", VIREMENT: "Virement", CHEQUE: "Chèque", MIXTE: "Mixte", CREDIT: "Crédit",
};

function fmtMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2}).format(n) + " XAF";
}
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function VentesHistoriqueTable({ ventes }: Props) {
  const router = useRouter();
  const [search,      setSearch]      = useState("");
  const [statut,      setStatut]      = useState<StatutVente | "">("");
  const [paiement,    setPaiement]    = useState<ModePaiement | "">("");
  const [dateDebut,   setDateDebut]   = useState("");
  const [dateFin,     setDateFin]     = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => ventes.filter(v => {
    if (statut   && v.statut       !== statut)   return false;
    if (paiement && v.modePaiement !== paiement) return false;
    if (dateDebut && new Date(v.createdAt) < new Date(dateDebut)) return false;
    if (dateFin   && new Date(v.createdAt) > new Date(dateFin + "T23:59:59")) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.numero.toLowerCase().includes(q) &&
          !(v.lignes?.some(l => l.produit.nom.toLowerCase().includes(q)) ?? false))
        return false;
    }
    return true;
  }), [ventes, search, statut, paiement, dateDebut, dateFin]);

  const stats = useMemo(() => ({
    ca:       filtered.filter(v => v.statut === "COMPLETEE").reduce((s, v) => s + v.total, 0),
    nb:       filtered.filter(v => v.statut === "COMPLETEE").length,
    annulees: filtered.filter(v => v.statut !== "COMPLETEE").length,
  }), [filtered]);

  const hasFilters = !!(search || statut || paiement || dateDebut || dateFin);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-600 font-medium">CA{hasFilters ? " filtré" : ""}</p>
          <p className="font-bold text-emerald-700 text-sm mt-0.5">{fmtMontant(stats.ca)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-600 font-medium">Ventes</p>
          <p className="font-bold text-blue-700 text-lg">{stats.nb}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-red-500 font-medium">Annulées</p>
          <p className="font-bold text-red-600 text-lg">{stats.annulees}</p>
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="N° vente ou produit..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={() => setShowFilters(v => !v)}
          className={cn("flex items-center gap-1.5 px-3 h-9 rounded-lg border text-sm font-medium transition-colors",
            showFilters || hasFilters ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          <Filter className="h-3.5 w-3.5" />
          Filtres{hasFilters && " •"}
        </button>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setStatut(""); setPaiement(""); setDateDebut(""); setDateFin(""); }}
            className="p-2 rounded-lg border hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl border bg-muted/30">
          <select value={statut} onChange={e => setStatut(e.target.value as StatutVente | "")}
            className="h-8 rounded-lg border bg-background px-2 text-sm">
            <option value="">Tous statuts</option>
            <option value="COMPLETEE">Complétée</option>
            <option value="ANNULEE">Annulée</option>
            <option value="REMBOURSEE">Remboursée</option>
          </select>
          <select value={paiement} onChange={e => setPaiement(e.target.value as ModePaiement | "")}
            className="h-8 rounded-lg border bg-background px-2 text-sm">
            <option value="">Tout paiement</option>
            {(Object.entries(MODE_LABELS) as [ModePaiement, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm" />
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-sm" />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">
          {hasFilters ? "Aucune vente ne correspond aux filtres" : "Aucune vente enregistrée"}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} résultat{filtered.length > 1 ? "s" : ""}</p>
          <div className="overflow-x-auto rounded-xl border">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>N° Vente</th>
                  {ventes[0]?.lignes !== undefined && <th className="hidden md:table-cell">Produits</th>}
                  <th className="text-right">Total</th>
                  <th className="hidden sm:table-cell">Paiement</th>
                  <th>Statut</th>
                  <th className="hidden lg:table-cell">Vendeur</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const s = STATUT_LABELS[v.statut];
                  return (
                    <tr key={v.id} onClick={() => router.push(`/ventes/${v.id}`)} className="hover:bg-gray-50 cursor-pointer">
                      <td className="text-sm text-gray-500 whitespace-nowrap">{fmtDate(v.createdAt)}</td>
                      <td>
                        <span className="font-mono text-sm text-primary font-semibold">
                          {v.numero}
                        </span>
                      </td>
                      {v.lignes !== undefined && (
                        <td className="hidden md:table-cell text-xs text-muted-foreground max-w-[180px] truncate">
                          {v.lignes.map(l => l.produit.nom).join(", ")}
                        </td>
                      )}
                      <td className="text-right">
                        <span className={cn("font-semibold", v.statut === "COMPLETEE" ? "text-gray-900" : "text-gray-400 line-through")}>
                          {fmtMontant(v.total)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-500 hidden sm:table-cell">{MODE_LABELS[v.modePaiement]}</td>
                      <td><span className={s.classes}>{s.label}</span></td>
                      <td className="text-sm text-gray-500 hidden lg:table-cell">{v.vendeur.prenom} {v.vendeur.nom}</td>
                      <td>
                        <span className="text-indigo-600 text-sm font-medium">Voir →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
