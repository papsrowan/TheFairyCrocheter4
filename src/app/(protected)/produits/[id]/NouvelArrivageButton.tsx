"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, X, Loader2 } from "lucide-react";

interface VarianteExistante { couleur: string; description: string | null }
interface Ligne { couleur: string; quantite: string; prixAchat: string }

export function NouvelArrivageButton({
  produitId, couleursExistantes,
}: { produitId: string; couleursExistantes: VarianteExistante[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([{ couleur: "", quantite: "", prixAchat: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLigne = (i: number, champ: keyof Ligne, val: string) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, [champ]: val } : l)));
  const addLigne = (couleur = "") => setLignes((ls) => [...ls, { couleur, quantite: "", prixAchat: "" }]);
  const removeLigne = (i: number) => setLignes((ls) => ls.filter((_, j) => j !== i));

  async function submit() {
    const payload = {
      motif: motif.trim() || undefined,
      lignes: lignes
        .map((l) => ({ couleur: l.couleur.trim(), quantite: parseInt(l.quantite) || 0, prixAchat: l.prixAchat ? parseFloat(l.prixAchat.replace(",", ".")) : null }))
        .filter((l) => l.couleur && l.quantite > 0),
    };
    if (payload.lignes.length === 0) { setError("Ajoutez au moins une couleur avec une quantité."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/produits/${produitId}/arrivages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
      setOpen(false); setLignes([{ couleur: "", quantite: "", prixAchat: "" }]); setMotif("");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
        <PackagePlus className="h-4 w-4" /> Nouvel arrivage
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col max-h-[92dvh]">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h2 className="font-bold">Nouvel arrivage</h2>
                <p className="text-xs text-muted-foreground">Ajoute des couleurs et quantités à ce produit — regroupées dans un lot daté.</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Couleurs déjà connues → clic pour pré-remplir */}
              {couleursExistantes.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Couleurs existantes (cliquer pour ajouter)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {couleursExistantes.map((v) => (
                      <button key={v.couleur} type="button" onClick={() => addLigne(v.couleur)}
                        title={v.description ?? v.couleur}
                        className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs hover:bg-muted">
                        <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: v.couleur }} />
                        {v.couleur}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lignes couleur + quantité */}
              <div className="space-y-2">
                {lignes.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <label className="shrink-0 cursor-pointer" title="Couleur">
                      <span className="block w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ background: l.couleur || "#eee" }} />
                      <input type="color" className="sr-only" value={l.couleur.startsWith("#") ? l.couleur : "#C17F24"}
                        onChange={(e) => setLigne(i, "couleur", e.target.value)} />
                    </label>
                    <input value={l.couleur} onChange={(e) => setLigne(i, "couleur", e.target.value)}
                      placeholder="Couleur (nom ou #hex)"
                      className="flex-1 h-9 rounded-lg border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    <input type="number" min={1} value={l.quantite} onChange={(e) => setLigne(i, "quantite", e.target.value)}
                      placeholder="Qté"
                      className="w-16 h-9 rounded-lg border bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    <input value={l.prixAchat} onChange={(e) => setLigne(i, "prixAchat", e.target.value)}
                      placeholder="Px achat" inputMode="decimal"
                      className="w-20 h-9 rounded-lg border bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring" />
                    <button type="button" onClick={() => removeLigne(i)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => addLigne()}
                className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline">
                <Plus className="h-4 w-4" /> Ajouter une couleur
              </button>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Motif / note (optionnel)</label>
                <input value={motif} onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex: réapprovisionnement fournisseur"
                  className="w-full h-9 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              {error && <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}
            </div>

            <div className="border-t px-5 py-4 flex gap-3 shrink-0">
              <button onClick={() => setOpen(false)} className="flex-1 h-10 rounded-lg border text-sm hover:bg-muted">Annuler</button>
              <button onClick={submit} disabled={loading}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
                Enregistrer l&apos;arrivage
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
