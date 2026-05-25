"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import {
  X, Plus, Trash2, Minus, Percent, Search,
  Loader2, CheckCircle, User, CreditCard, Banknote, ArrowLeftRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LigneEdit {
  _key: string;
  produitId: string;
  nom: string;
  prixUnitaire: number;
  tauxTVA: number;
  quantite: number;
  remise: number;
}

interface Produit { id: string; nom: string; prixVente: number; tauxTVA: number; stockActuel: number }
interface Client  { id: string; nom: string; prenom?: string; telephone?: string }

const MODES = [
  { value: "ESPECES",  label: "Espèces",   icon: Banknote       },
  { value: "CARTE",    label: "Carte",     icon: CreditCard     },
  { value: "VIREMENT", label: "Virement",  icon: ArrowLeftRight },
] as const;

function calcLigne(l: LigneEdit) {
  return Math.round(l.prixUnitaire * l.quantite * (1 - l.remise / 100));
}
function calcTotal(lignes: LigneEdit[], remiseGlobale: number) {
  const sous = lignes.reduce((s, l) => s + calcLigne(l), 0);
  return Math.round(sous * (1 - remiseGlobale / 100));
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  vente: {
    id: string; numero: string;
    clientId?: string | null; clientNom?: string;
    modePaiement: string; remiseGlobale: number; notes?: string | null;
    lignes: Array<{ produitId: string; nom: string; prixUnitaire: number; tauxTVA: number; quantite: number; remise: number }>;
  };
  onClose: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export function VenteEditModal({ vente, onClose }: Props) {
  const router = useRouter();

  const [lignes, setLignes] = useState<LigneEdit[]>(
    vente.lignes.map((l, i) => ({ _key: `${i}`, ...l }))
  );
  const [clientId,      setClientId]      = useState<string | null>(vente.clientId ?? null);
  const [clientNom,     setClientNom]     = useState(vente.clientNom ?? "");
  const [modePaiement,  setModePaiement]  = useState(vente.modePaiement);
  const [remiseGlobale, setRemiseGlobale] = useState(vente.remiseGlobale);
  const [notes,         setNotes]         = useState(vente.notes ?? "");
  const [prodSearch,    setProdSearch]    = useState("");
  const [clientSearch,  setClientSearch]  = useState("");
  const [showProdDD,    setShowProdDD]    = useState(false);
  const [showClientDD,  setShowClientDD]  = useState(false);
  const keyRef = useRef(100);

  const total = calcTotal(lignes, remiseGlobale);

  // Recherche produits
  const { data: prodData } = useQuery({
    queryKey: ["edit-prod-search", prodSearch],
    queryFn: async () => {
      if (prodSearch.length < 1) return { data: [] };
      const r = await fetch(`/api/produits/search?q=${encodeURIComponent(prodSearch)}&limit=6`);
      return r.json() as Promise<{ data: Produit[] }>;
    },
    enabled: prodSearch.length >= 1,
    staleTime: 5_000,
  });

  // Recherche clients
  const { data: clientData } = useQuery({
    queryKey: ["edit-client-search", clientSearch],
    queryFn: async () => {
      if (clientSearch.length < 2) return { data: [] };
      const r = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&pageSize=5`);
      return r.json() as Promise<{ data: Client[] }>;
    },
    enabled: clientSearch.length >= 2,
    staleTime: 10_000,
  });

  const addProduit = useCallback((p: Produit) => {
    setLignes(prev => {
      const ex = prev.find(l => l.produitId === p.id);
      if (ex) return prev.map(l => l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l);
      return [...prev, { _key: String(keyRef.current++), produitId: p.id, nom: p.nom, prixUnitaire: p.prixVente, tauxTVA: p.tauxTVA, quantite: 1, remise: 0 }];
    });
    setProdSearch(""); setShowProdDD(false);
  }, []);

  const updateLigne = (key: string, field: "quantite" | "remise", val: number) => {
    setLignes(prev => prev.map(l => l._key === key ? { ...l, [field]: Math.max(field === "quantite" ? 1 : 0, val) } : l));
  };

  const removeLigne = (key: string) => setLignes(prev => prev.filter(l => l._key !== key));

  const { mutate: sauvegarder, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ventes/${vente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, modePaiement, remiseGlobale, notes: notes || null,
          lignes: lignes.map(l => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire, remise: l.remise, tauxTVA: l.tauxTVA })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
    },
    onSuccess: () => { router.refresh(); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-card rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[95dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div>
            <h2 className="font-bold text-lg">Modifier la vente</h2>
            <p className="text-xs text-muted-foreground font-mono">{vente.numero}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Client */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Client</label>
            <div className="relative">
              {clientId ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-900/20 text-sm">
                  <span className="flex items-center gap-2 text-blue-700 font-medium"><User className="h-3.5 w-3.5" />{clientNom}</span>
                  <button onClick={() => { setClientId(null); setClientNom(""); }} className="text-blue-400 hover:text-blue-700"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientDD(true); }}
                      onFocus={() => setShowClientDD(true)}
                      placeholder="Rechercher un client..." className="w-full h-9 pl-9 pr-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  {showClientDD && clientSearch.length >= 2 && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg border bg-card shadow-lg">
                      {(clientData?.data ?? []).map(c => (
                        <button key={c.id} onClick={() => { setClientId(c.id); setClientNom(`${c.prenom ?? ""} ${c.nom}`.trim()); setClientSearch(""); setShowClientDD(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent text-left text-sm">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{c.prenom ?? ""} {c.nom}</span>
                          {c.telephone && <span className="text-xs text-muted-foreground ml-auto">{c.telephone}</span>}
                        </button>
                      ))}
                      {(clientData?.data ?? []).length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Aucun résultat</p>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Lignes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Articles ({lignes.length})</label>
            <div className="space-y-2 mb-3">
              {lignes.map(l => (
                <div key={l._key} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.nom}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(l.prixUnitaire)}/u</p>
                  </div>
                  {/* Quantité */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateLigne(l._key, "quantite", l.quantite - 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center font-bold tabular-nums">{l.quantite}</span>
                    <button onClick={() => updateLigne(l._key, "quantite", l.quantite + 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-muted"><Plus className="h-3 w-3" /></button>
                  </div>
                  {/* Remise ligne */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Percent className="h-3 w-3 text-muted-foreground" />
                    <input type="number" min={0} max={100} value={l.remise}
                      onChange={e => updateLigne(l._key, "remise", parseFloat(e.target.value) || 0)}
                      className="w-12 h-6 rounded border text-xs text-center px-1" />
                  </div>
                  <span className="font-bold text-primary shrink-0 w-20 text-right">{formatCurrency(calcLigne(l))}</span>
                  <button onClick={() => removeLigne(l._key)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>

            {/* Ajouter un produit */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={prodSearch} onChange={e => { setProdSearch(e.target.value); setShowProdDD(true); }}
                  onFocus={() => setShowProdDD(true)}
                  placeholder="+ Ajouter un produit (nom ou code-barres)..."
                  className="w-full h-9 pl-9 pr-3 rounded-lg border border-dashed text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-muted/20" />
              </div>
              {showProdDD && prodSearch.length >= 1 && (
                <div className="absolute z-10 w-full mt-1 rounded-lg border bg-card shadow-lg max-h-48 overflow-y-auto">
                  {(prodData?.data ?? []).map(p => (
                    <button key={p.id} onClick={() => addProduit(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent text-left text-sm">
                      <span className="font-medium">{p.nom}</span>
                      <span className="text-primary font-bold">{formatCurrency(p.prixVente)}</span>
                    </button>
                  ))}
                  {(prodData?.data ?? []).length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Aucun produit trouvé</p>}
                </div>
              )}
            </div>
          </div>

          {/* Mode paiement + remise globale */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Paiement</label>
              <div className="flex gap-1.5">
                {MODES.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => setModePaiement(value)}
                    className={cn("flex-1 flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all",
                      modePaiement === value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                    <Icon className="h-3.5 w-3.5" />{label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Remise globale</label>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={100} value={remiseGlobale}
                  onChange={e => setRemiseGlobale(parseFloat(e.target.value) || 0)}
                  className="flex-1 h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <span className="text-muted-foreground text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Motif de modification, remarques..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
        </div>

        {/* Footer totaux + actions */}
        <div className="border-t px-5 py-4 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between mb-3 text-sm">
            <span className="text-muted-foreground">Nouveau total</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
          {total !== calcTotal(vente.lignes.map((l, i) => ({ _key: String(i), ...l })), vente.remiseGlobale) && (
            <p className="text-xs text-amber-600 mb-3">
              ⚠ Différence : {formatCurrency(total - calcTotal(vente.lignes.map((l, i) => ({ _key: String(i), ...l })), vente.remiseGlobale))} XAF par rapport à la vente initiale
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-10 rounded-lg border text-sm hover:bg-muted transition-colors">Annuler</button>
            <button onClick={() => sauvegarder()} disabled={isPending || lignes.length === 0}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
