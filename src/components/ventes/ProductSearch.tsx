"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT SEARCH — Recherche instantanée + scan code-barres pour la caisse
// Supporte le mode offline via cache IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback, useMemo, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/stores/cartStore";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { Search, Barcode, Package, AlertTriangle, Loader2, X } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getOfflineDB } from "@/lib/offline/db";

interface VarianteCouleur { id: string; couleur: string; stockActuel: number; }

function varianteKey(produitId: string, varianteId?: string | null) {
  return varianteId ? `${produitId}__${varianteId}` : produitId;
}

interface SearchResult {
  id: string;
  nom: string;
  codeBarres?: string;
  prixVente: number;
  prixGros?: number | null;
  qtePrixGros?: number | null;
  tauxTVA: number;
  stockActuel: number;
  stockMinimum: number;
  imageUrl?: string;
  categorie?: { nom: string };
  variantes?: VarianteCouleur[];
}

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pendingAddRef = useRef(false);
  const [, startTransition] = useTransition();
  const { isOffline } = useOnlineStatus();
  const addItem = useCartStore((s) => s.addItem);

  // Modal de confirmation avant ajout
  const [pending, setPending] = useState<SearchResult | null>(null);
  const [tvaChoisie, setTvaChoisie] = useState(0);
  // Sélection multi-couleurs : varianteId → quantité choisie
  const [selectionVariantes, setSelectionVariantes] = useState<Record<string, number>>({});
  // Sélection simple (sans variantes)
  const [qteChoisie, setQteChoisie] = useState(1);

  // Recherche online via API ou offline via IndexedDB
  // query vide = afficher tous les produits (limite 24)
  const { data, isFetching } = useQuery({
    queryKey: ["produits", "search", query, isOffline],
    queryFn: async () => {
      if (isOffline) {
        const db = getOfflineDB();
        if (!db) return { data: [] };
        const q = query.toLowerCase();
        const cached = await db.produits
          .filter(p => p.actif && (!q || p.nom.toLowerCase().includes(q) || (p.codeBarres ?? "").includes(q)))
          .limit(query ? 8 : 24)
          .toArray();
        return {
          data: cached.map((p) => ({
            id: p.id, nom: p.nom, codeBarres: p.codeBarres,
            prixVente: p.prixVente, tauxTVA: p.tauxTVA,
            stockActuel: p.stockActuel, stockMinimum: p.stockMinimum,
            categorie: p.categorie ? { nom: p.categorie } : undefined,
          })) as SearchResult[],
        };
      }
      const limit = query ? 8 : 24;
      const url = query
        ? `/api/produits/search?q=${encodeURIComponent(query)}&limit=${limit}`
        : `/api/produits/search?q=&limit=${limit}&all=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur de recherche");
      return res.json() as Promise<{ data: SearchResult[] }>;
    },
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });

  const results = useMemo(() => data?.data ?? [], [data]);

  // Fermer le dropdown en cliquant en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Afficher le dropdown + gérer l'ajout différé (scan douchette)
  useEffect(() => {
    setIsOpen(query.length >= 1 && results.length > 0);
    if (pendingAddRef.current && results.length > 0) {
      pendingAddRef.current = false;
      startTransition(() => selectProduct(results[0]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, query]);

  // Focus automatique sur le champ au montage (caisse = focus permanent)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const confirmerAjout = useCallback((produit: SearchResult, tva: number) => {
    const hasVariantes = (produit.variantes?.length ?? 0) > 0;

    if (hasVariantes) {
      // Ajouter une ligne par couleur sélectionnée
      let ajouté = false;
      for (const variante of produit.variantes!) {
        const qte = selectionVariantes[variante.id] ?? 0;
        if (qte <= 0) continue;
        if (qte > variante.stockActuel) continue;
        addItem({
          produitId:   produit.id,
          varianteId:  variante.id,
          nom:         produit.nom,
          codeBarres:  produit.codeBarres,
          couleur:     variante.couleur,
          quantite:    qte,
          prixBase:    produit.prixVente,
          prixGros:    produit.prixGros,
          qtePrixGros: produit.qtePrixGros,
          prixGrosApplique: false,
          prixUnitaire: produit.prixVente,
          remise:      0,
          tauxTVA:     tva,
        });
        ajouté = true;
      }
      if (!ajouté) return;
    } else {
      addItem({
        produitId:   produit.id,
        varianteId:  null,
        nom:         produit.nom,
        codeBarres:  produit.codeBarres,
        couleur:     null,
        quantite:    qteChoisie,
        prixBase:    produit.prixVente,
        prixGros:    produit.prixGros,
        qtePrixGros: produit.qtePrixGros,
        prixGrosApplique: false,
        prixUnitaire: produit.prixVente,
        remise:      0,
        tauxTVA:     tva,
      });
    }

    setPending(null);
    setSelectionVariantes({});
    setQteChoisie(1);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  }, [addItem, selectionVariantes, qteChoisie]);

  const selectProduct = useCallback(
    (produit: SearchResult) => {
      // Si le produit a des variantes couleur OU une TVA non nulle → modal de confirmation
      const hasVariantes = (produit.variantes?.length ?? 0) > 0;
      if (hasVariantes || produit.tauxTVA > 0) {
        setTvaChoisie(produit.tauxTVA);
        setSelectionVariantes({});
        setQteChoisie(1);
        setPending(produit);
        setQuery("");
        setIsOpen(false);
        return;
      }
      // Sinon ajout direct
      confirmerAjout(produit, produit.tauxTVA);
    },
    [addItem, confirmerAjout]
  );

  // Entrée = ajouter immédiatement si résultats dispo, sinon marquer "pending" (scan douchette)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (results.length > 0) {
          selectProduct(results[0]);
        } else if (query.length >= 1) {
          // Douchette rapide : résultats pas encore arrivés → on attend
          pendingAddRef.current = true;
        }
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        pendingAddRef.current = false;
      }
    },
    [results, selectProduct, query]
  );

  const TVA_OPTIONS = [0, 5.5, 10, 20];

  return (
    <div className="relative w-full">
      {/* ── Modal confirmation avant ajout ── */}
      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl p-4 max-h-[90dvh] overflow-y-auto"
            style={{ animation: "slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1) both" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-base">{pending.nom}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(pending.prixVente)} / unité</p>
                {pending.prixGros && pending.qtePrixGros && (
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">
                    Prix de gros : {formatCurrency(pending.prixGros)} dès {pending.qtePrixGros} u.
                  </p>
                )}
              </div>
              <button onClick={() => setPending(null)} className="p-1.5 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            {(() => {
              const hasVariantes = (pending.variantes?.length ?? 0) > 0;
              const totalQte = hasVariantes
                ? Object.values(selectionVariantes).reduce((s, q) => s + q, 0)
                : qteChoisie;
              const totalPrix = pending.prixVente * totalQte;
              const hasSelection = hasVariantes ? totalQte > 0 : qteChoisie >= 1;
              const hasError = hasVariantes && pending.variantes!.some(
                v => (selectionVariantes[v.id] ?? 0) > v.stockActuel
              );

              return (
                <div className="space-y-4">
                  {hasVariantes ? (
                    /* ── Sélection multi-couleurs ── */
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">
                        Choisir les couleurs et quantités
                      </label>
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1 -mr-1">
                        {pending.variantes!.map(v => {
                          const qte = selectionVariantes[v.id] ?? 0;
                          const overStock = qte > v.stockActuel;
                          return (
                            <div key={v.id} className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-colors",
                              qte > 0 ? "border-primary/50 bg-primary/5" : "border-border",
                              v.stockActuel <= 0 && "opacity-40"
                            )}>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0"
                                  style={{ backgroundColor: v.couleur }} />
                                <span className="text-sm font-medium truncate">{v.couleur}</span>
                                <span className={cn("text-xs shrink-0", overStock ? "text-destructive font-bold" : "text-muted-foreground")}>
                                  {qte > 0 && overStock ? `max ${v.stockActuel}` : `${v.stockActuel} dispo`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  disabled={qte <= 0}
                                  onClick={() => setSelectionVariantes(prev => ({ ...prev, [v.id]: Math.max(0, qte - 1) }))}
                                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-30 transition-colors">−</button>
                                <span className={cn("w-8 text-center font-bold text-sm tabular-nums", qte > 0 ? "text-primary" : "text-muted-foreground")}>
                                  {qte}
                                </span>
                                <button
                                  disabled={v.stockActuel <= 0 || qte >= v.stockActuel}
                                  onClick={() => setSelectionVariantes(prev => ({ ...prev, [v.id]: qte + 1 }))}
                                  className="w-8 h-8 rounded-lg border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-30 transition-colors">+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {totalQte > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 text-right">
                          Total sélectionné : <span className="font-bold text-foreground">{totalQte} unité{totalQte > 1 ? "s" : ""}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    /* ── Quantité simple (sans variantes) ── */
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Quantité</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQteChoisie(q => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg hover:bg-muted transition-colors">−</button>
                        <input type="number" min={1} value={qteChoisie}
                          onChange={e => setQteChoisie(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 h-9 rounded-xl border text-center font-bold text-base focus:outline-none focus:ring-2 focus:ring-ring" />
                        <button onClick={() => setQteChoisie(q => q + 1)}
                          className="w-9 h-9 rounded-xl border flex items-center justify-center text-lg hover:bg-muted transition-colors">+</button>
                      </div>
                    </div>
                  )}

                  {/* TVA */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">TVA</label>
                    <div className="flex gap-2">
                      {TVA_OPTIONS.map(t => (
                        <button key={t} onClick={() => setTvaChoisie(t)}
                          className={cn("flex-1 py-2 rounded-xl border text-sm font-semibold transition-all",
                            tvaChoisie === t ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}>
                          {t}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => confirmerAjout(pending, tvaChoisie)}
                    disabled={!hasSelection || hasError}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {totalQte > 0
                      ? `Ajouter au panier — ${formatCurrency(totalPrix)}`
                      : "Sélectionner au moins une couleur"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Champ de recherche */}
      <div className="relative">
        {isFetching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin" />
        ) : query.length > 0 && /^\d{4,}$/.test(query) ? (
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}

        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={query}
          onChange={(e) => { pendingAddRef.current = false; setQuery(e.target.value); }}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={isOffline ? "Mode hors ligne — recherche limitée" : "Scanner un code-barres ou taper le nom..."}
          className={cn(
            "pos-input w-full pl-11 pr-4 text-base",
            isOffline && "border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10"
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {isOffline && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-yellow-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Hors ligne</span>
          </div>
        )}
      </div>

      {/* Grille produits quand champ vide */}
      {!query && results.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> {results.length} produit{results.length > 1 ? "s" : ""} — cliquer pour ajouter
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {results.map(produit => (
              <button key={produit.id} type="button" onClick={() => selectProduct(produit)}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-xl border bg-card text-left transition-all active:scale-[0.97]",
                  "hover:border-primary/50 hover:bg-primary/[0.03]",
                  produit.stockActuel <= 0 && "opacity-50"
                )}>
                <div className="flex items-center justify-between w-full gap-1">
                  <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">{produit.nom}</span>
                  {produit.stockActuel <= produit.stockMinimum && produit.stockActuel > 0 && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 rounded px-1 shrink-0">⚠</span>
                  )}
                </div>
                <span className="text-sm font-bold text-primary">{new Intl.NumberFormat("fr-FR").format(produit.prixVente)} XAF</span>
                <span className={cn("text-[10px]", produit.stockActuel <= 0 ? "text-destructive" : "text-muted-foreground")}>
                  Stock : {produit.stockActuel}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown résultats de recherche */}
      {isOpen && query && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 rounded-lg border bg-card shadow-xl overflow-hidden"
        >
          <ul className="max-h-96 overflow-y-auto divide-y divide-border">
            {results.map((produit, index) => (
              <li key={produit.id}>
                <button
                  type="button"
                  onClick={() => selectProduct(produit)}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-3 text-left",
                    "hover:bg-accent transition-colors",
                    index === 0 && "bg-accent/50" // Premier résultat mis en avant
                  )}
                >
                  {/* Icône produit */}
                  <div className="shrink-0 w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                    {produit.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={produit.imageUrl}
                        alt={produit.nom}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Infos produit */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{produit.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {produit.categorie?.nom && (
                        <span className="mr-2">{produit.categorie.nom}</span>
                      )}
                      {produit.codeBarres && (
                        <span className="font-mono">{produit.codeBarres}</span>
                      )}
                    </p>
                  </div>

                  {/* Prix + stock */}
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">
                      {formatCurrency(produit.prixVente)}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        produit.stockActuel <= produit.stockMinimum
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      Stock : {produit.stockActuel}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="px-4 py-2 bg-muted/50 border-t">
            <p className="text-xs text-muted-foreground">
              ↵ Entrée pour ajouter le premier résultat · Échap pour fermer
            </p>
          </div>
        </div>
      )}

      {/* Aucun résultat de recherche */}
      {isOpen && query.length >= 2 && results.length === 0 && !isFetching && (
        <div className="absolute z-50 w-full mt-2 rounded-lg border bg-card shadow-xl p-6 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun produit trouvé pour &quot;{query}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
