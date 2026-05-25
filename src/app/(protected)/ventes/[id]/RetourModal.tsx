"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, RotateCcw, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Ligne {
  produitId: string;
  nom: string;
  quantiteVendue: number;
  prixUnitaire: number;
}

interface Props {
  venteId: string;
  lignes: Ligne[];
  onClose: () => void;
}

const CONDITIONS = [
  { value: "NEUF",      label: "Neuf",       color: "text-emerald-600" },
  { value: "BON_ETAT",  label: "Bon état",   color: "text-blue-600"    },
  { value: "ABIME",     label: "Abîmé",      color: "text-red-500"     },
] as const;

function fmtXAF(n: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(n) + " XAF";
}

export function RetourModal({ venteId, lignes, onClose }: Props) {
  const router = useRouter();
  const [motif,   setMotif]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selections, setSelections] = useState<Record<string, {
    selected: boolean; quantite: number; condition: "NEUF" | "BON_ETAT" | "ABIME";
  }>>(
    Object.fromEntries(lignes.map(l => [l.produitId, { selected: false, quantite: 1, condition: "BON_ETAT" }]))
  );

  const lignesSelectionnees = lignes.filter(l => selections[l.produitId]?.selected);
  const totalRembourse = lignesSelectionnees.reduce((s, l) => {
    const sel = selections[l.produitId];
    return s + l.prixUnitaire * (sel?.quantite ?? 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lignesSelectionnees.length) { setError("Sélectionnez au moins un article"); return; }
    if (!motif.trim()) { setError("Le motif est requis"); return; }
    setError(null); setLoading(true);

    try {
      const res = await fetch("/api/retours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venteId,
          motif: motif.trim(),
          lignes: lignesSelectionnees.map(l => ({
            produitId:    l.produitId,
            quantite:     selections[l.produitId].quantite,
            prixUnitaire: l.prixUnitaire,
            condition:    selections[l.produitId].condition,
          })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      setSuccess(true);
      setTimeout(() => { onClose(); router.refresh(); }, 1500);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[90dvh]">

        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" />
            <h2 className="font-bold">Retour produit</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <p className="font-semibold text-emerald-700">Retour enregistré</p>
            <p className="text-sm text-muted-foreground">Stock mis à jour · Remboursement : {fmtXAF(totalRembourse)}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {error && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

              {/* Sélection articles */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Articles à retourner</p>
                <div className="space-y-2">
                  {lignes.map(l => {
                    const sel = selections[l.produitId];
                    return (
                      <div key={l.produitId} className={cn(
                        "rounded-xl border p-3 transition-colors",
                        sel.selected ? "border-primary/40 bg-primary/5" : "bg-muted/20"
                      )}>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={sel.selected}
                            onChange={e => setSelections(s => ({ ...s, [l.produitId]: { ...s[l.produitId], selected: e.target.checked } }))}
                            className="rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{l.nom}</p>
                            <p className="text-xs text-muted-foreground">{fmtXAF(l.prixUnitaire)}/u · vendu {l.quantiteVendue}</p>
                          </div>
                        </label>

                        {sel.selected && (
                          <div className="mt-3 flex flex-wrap gap-3 pl-7">
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground">Qté retournée</label>
                              <input type="number" min={1} max={l.quantiteVendue}
                                value={sel.quantite}
                                onChange={e => setSelections(s => ({ ...s, [l.produitId]: { ...s[l.produitId], quantite: Math.min(parseInt(e.target.value) || 1, l.quantiteVendue) } }))}
                                className="w-16 h-7 rounded-lg border text-center text-sm px-1" />
                            </div>
                            <div className="flex gap-1">
                              {CONDITIONS.map(c => (
                                <button key={c.value} type="button"
                                  onClick={() => setSelections(s => ({ ...s, [l.produitId]: { ...s[l.produitId], condition: c.value } }))}
                                  className={cn(
                                    "text-xs px-2 py-1 rounded-lg border font-medium transition-colors",
                                    sel.condition === c.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                                  )}>
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Motif */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Motif du retour <span className="text-destructive">*</span>
                </label>
                <textarea value={motif} onChange={e => setMotif(e.target.value)}
                  rows={2} required maxLength={300}
                  placeholder="Ex : article défectueux, mauvaise taille..."
                  className="w-full rounded-xl border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4 bg-muted/20 shrink-0">
              {totalRembourse > 0 && (
                <p className="text-sm mb-3 flex justify-between">
                  <span className="text-muted-foreground">Montant à rembourser</span>
                  <span className="font-bold text-primary">{fmtXAF(totalRembourse)}</span>
                </p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="flex-1 h-10 rounded-xl border text-sm hover:bg-muted transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={loading || !lignesSelectionnees.length}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Enregistrer le retour
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
