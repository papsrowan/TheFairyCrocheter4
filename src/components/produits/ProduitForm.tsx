"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Camera, Loader2, AlertCircle, X, Plus, Palette,
} from "lucide-react";

const QUICK_COLORS = [
  { label: "Blanc",        hex: "#FFFFFF" },
  { label: "Crème",        hex: "#FDF8F0" },
  { label: "Jaune",        hex: "#FFD700" },
  { label: "Orange",       hex: "#FFA500" },
  { label: "Rose",         hex: "#FF6B9D" },
  { label: "Rouge",        hex: "#E53E3E" },
  { label: "Bordeaux",     hex: "#800020" },
  { label: "Violet",       hex: "#9C27B0" },
  { label: "Bleu marine",  hex: "#1A237E" },
  { label: "Bleu ciel",    hex: "#2196F3" },
  { label: "Turquoise",    hex: "#00BCD4" },
  { label: "Vert",         hex: "#4CAF50" },
  { label: "Kaki",         hex: "#8BC34A" },
  { label: "Marron",       hex: "#795548" },
  { label: "Camel",        hex: "#C17F24" },
  { label: "Gris",         hex: "#607D8B" },
  { label: "Noir",         hex: "#212121" },
  { label: "Or",           hex: "#FFB300" },
  { label: "Argent",       hex: "#B0BEC5" },
  { label: "Multi Color",  hex: "linear" },
];
import { cn } from "@/lib/utils/cn";
import Image from "next/image";

interface Categorie { id: string; nom: string }

interface ProduitFormData {
  nom:             string;
  description:     string;
  categorieId:     string;
  poids:           string;
  prixVente:       string;
  prixGros:        string;
  qtePrixGros:     string;
  prixAchat:       string;
  stockActuel:     string;
  stockMinimum:    string;
  imageUrl:        string;
  dateAcquisition: string;
}

interface ProduitFormProps {
  categories:   Categorie[];
  initialData?: Partial<ProduitFormData> & { id?: string };
  mode:         "create" | "edit";
}


export default function ProduitForm({ categories, initialData, mode }: ProduitFormProps) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  // Variantes couleurs
  const [variantes, setVariantes] = useState<Array<{ couleur: string; stockActuel: number; id?: string }>>(
    (initialData as { variantes?: Array<{ id: string; couleur: string; stockActuel: number }> })?.variantes ?? []
  );
  const [newVarianteCouleur, setNewVarianteCouleur] = useState("");
  const [newCatNom,   setNewCatNom]   = useState("");
  const [localCats,   setLocalCats]   = useState(categories);

  const [form, setForm] = useState<ProduitFormData>({
    nom:             initialData?.nom             ?? "",
    description:     initialData?.description     ?? "",
    categorieId:     initialData?.categorieId     ?? "",
    poids:           initialData?.poids           ?? "",
    prixVente:       initialData?.prixVente       ?? "",
    prixGros:        initialData?.prixGros        ?? "",
    qtePrixGros:     initialData?.qtePrixGros     ?? "",
    prixAchat:       initialData?.prixAchat       ?? "0",
    stockActuel:     initialData?.stockActuel     ?? "0",
    stockMinimum:    initialData?.stockMinimum    ?? "5",
    imageUrl:        initialData?.imageUrl        ?? "",
    dateAcquisition: initialData?.dateAcquisition ?? "",
  });

  // Stock total automatique depuis les variantes
  const stockTotalVariantes = variantes.reduce((s, v) => s + v.stockActuel, 0);
  const hasVariantes = variantes.length > 0;

  const set = (k: keyof ProduitFormData, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  /* ── Upload image ── */
  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur upload");
      set("imageUrl", json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  /* ── Créer catégorie ── */
  async function handleCreateCat() {
    if (!newCatNom.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: newCatNom.trim() }),
    });
    if (!res.ok) { setError("Erreur création catégorie"); return; }
    const cat = await res.json();
    setLocalCats((prev) => [...prev, cat].sort((a, b) => a.nom.localeCompare(b.nom)));
    set("categorieId", cat.id);
    setNewCatNom("");
    setShowNewCat(false);
  }

  /* ── Soumettre ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const stockFinal = hasVariantes ? stockTotalVariantes : (parseInt(form.stockActuel) || 0);
    const payload = {
      nom:             form.nom,
      description:     form.description || undefined,
      categorieId:     form.categorieId || null,
      poids:           form.poids || null,
      prixVente:       parseFloat(form.prixVente),
      prixGros:        form.prixGros ? parseFloat(form.prixGros) : null,
      qtePrixGros:     form.qtePrixGros ? parseInt(form.qtePrixGros) : null,
      prixAchat:       parseFloat(form.prixAchat) || 0,
      tauxTVA:         0,
      stockActuel:     stockFinal,
      stockMinimum:    parseInt(form.stockMinimum) || 5,
      imageUrl:        form.imageUrl || null,
      couleur:         null,
      dateAcquisition: form.dateAcquisition || null,
      variantes:       variantes.filter(v => v.couleur.trim()),
    };

    try {
      const url    = mode === "create" ? "/api/produits" : `/api/produits/${initialData?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      router.push(`/produits/${(json as { id: string }).id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Photo du produit ── */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" /> Photo du produit
        </h2>

        {/* Preview */}
        {form.imageUrl ? (
          <div className="relative w-32 h-32 rounded-xl overflow-hidden border group">
            <Image src={form.imageUrl} alt="Photo produit" fill className="object-cover" />
            <button
              type="button"
              onClick={() => set("imageUrl", "")}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer",
              "hover:border-primary hover:bg-primary/5 transition-colors",
              uploading && "pointer-events-none opacity-60"
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-2" />
            ) : (
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm text-muted-foreground">
              {uploading ? "Upload en cours..." : "Cliquez pour ajouter une photo"}
            </p>
          </div>
        )}

        {/* Boutons upload */}
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs py-1.5">
            <Upload className="h-3.5 w-3.5" /> Choisir fichier
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-secondary text-xs py-1.5">
            <Camera className="h-3.5 w-3.5" /> Caméra
          </button>
        </div>
      </div>

      {/* ── Couleurs & stock par couleur ── */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Couleurs &amp; stock</h2>
          {hasVariantes && (
            <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg">
              Stock total : {stockTotalVariantes} unités
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Ajoutez une couleur par ligne avec son stock disponible. Le stock total du produit sera calculé automatiquement.
        </p>

        {/* Variantes existantes */}
        {variantes.length > 0 && (
          <div className="space-y-2">
            {variantes.map((v, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-xl border bg-muted/30">
                {/* Aperçu couleur + picker natif */}
                <label className="shrink-0 cursor-pointer" title="Changer la couleur">
                  <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ background: v.couleur.startsWith("#") ? v.couleur : v.couleur }} />
                  <input type="color" className="sr-only"
                    value={v.couleur.startsWith("#") ? v.couleur : "#C17F24"}
                    onChange={e => setVariantes(vs => vs.map((x, j) => j === i ? { ...x, couleur: e.target.value } : x))}
                  />
                </label>
                {/* Nom de la couleur */}
                <input
                  value={v.couleur}
                  onChange={e => setVariantes(vs => vs.map((x, j) => j === i ? { ...x, couleur: e.target.value } : x))}
                  placeholder="Nom (Rose, Bleu…)"
                  className="flex-1 h-8 rounded-lg border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {/* Stock */}
                <input type="number" min={0} value={v.stockActuel}
                  onChange={e => setVariantes(vs => vs.map((x, j) => j === i ? { ...x, stockActuel: parseInt(e.target.value) || 0 } : x))}
                  className="w-20 h-8 rounded-lg border bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground shrink-0">u.</span>
                <button type="button" onClick={() => setVariantes(vs => vs.filter((_, j) => j !== i))}
                  className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Palette rapide + champ + bouton ajouter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Palette className="h-3 w-3" /> Couleurs rapides
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COLORS.filter(c => c.hex !== "linear").map((c) => (
              <button key={c.hex} type="button"
                onClick={() => setNewVarianteCouleur(c.label)}
                title={c.label}
                className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {/* Picker couleur personnalisée */}
            <label title="Couleur personnalisée" className="w-6 h-6 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Palette className="h-3 w-3 text-muted-foreground" />
              <input type="color" className="sr-only"
                onChange={e => setNewVarianteCouleur(e.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <input
              value={newVarianteCouleur}
              onChange={e => setNewVarianteCouleur(e.target.value)}
              placeholder="Nom ou code couleur ex: Rose, #FF6B9D"
              className="flex-1 h-9 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button type="button"
              onClick={() => {
                if (newVarianteCouleur.trim()) {
                  setVariantes(vs => [...vs, { couleur: newVarianteCouleur.trim(), stockActuel: 0 }]);
                  setNewVarianteCouleur("");
                }
              }}
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors shrink-0">
              <Plus className="h-3.5 w-3.5" /> Ajouter
            </button>
          </div>
        </div>
      </div>

      {/* ── Informations produit ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Informations du produit</h2>

        <div>
          <label className="form-label">Nom du produit *</label>
          <input
            type="text" required maxLength={200}
            value={form.nom} onChange={(e) => set("nom", e.target.value)}
            className="form-input" placeholder="Ex: Laine mérinos dorée 50g"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Catégorie */}
          <div>
            <label className="form-label">Catégorie</label>
            <div className="flex gap-2">
              <select value={form.categorieId} onChange={(e) => set("categorieId", e.target.value)} className="form-select flex-1">
                <option value="">Sélectionner...</option>
                {localCats.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
              <button type="button" onClick={() => setShowNewCat(!showNewCat)}
                className="btn-ghost px-2 py-2" title="Nouvelle catégorie">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {showNewCat && (
              <div className="flex gap-2 mt-2">
                <input value={newCatNom} onChange={(e) => setNewCatNom(e.target.value)}
                  placeholder="Nom catégorie" className="form-input flex-1 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateCat())} />
                <button type="button" onClick={handleCreateCat} className="btn-primary text-xs px-3">Créer</button>
              </div>
            )}
          </div>

          {/* Poids */}
          <div>
            <label className="form-label">Poids</label>
            <input type="text" value={form.poids} onChange={(e) => set("poids", e.target.value)}
              className="form-input" placeholder="50g, 100g, 200g..." maxLength={20} />
          </div>
        </div>

        <div>
          <label className="form-label">Description</label>
          <textarea rows={2} maxLength={2000} value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="form-textarea" placeholder="Description optionnelle..." />
        </div>
      </div>

      {/* ── Prix (XAF) ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Prix (XAF)</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Prix Détail (XAF) *</label>
            <input type="number" required min="0" step="1"
              value={form.prixVente} onChange={(e) => set("prixVente", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
          <div>
            <label className="form-label">Prix de Gros (XAF)</label>
            <input type="number" min="0" step="1"
              value={form.prixGros} onChange={(e) => set("prixGros", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Qté min. Prix de Gros</label>
            <input type="number" min="0" step="1"
              value={form.qtePrixGros} onChange={(e) => set("qtePrixGros", e.target.value)}
              className="form-input" placeholder="Ex: 10" />
          </div>
          <div>
            <label className="form-label">Prix d&apos;achat (XAF)</label>
            <input type="number" min="0" step="1"
              value={form.prixAchat} onChange={(e) => set("prixAchat", e.target.value)}
              className="form-input" placeholder="0" />
          </div>
        </div>

        {/* Marge calculée */}
        {form.prixVente && parseFloat(form.prixVente) > 0 && parseFloat(form.prixAchat) > 0 && (
          <div className="text-sm bg-secondary rounded-xl px-4 py-2.5 text-secondary-foreground">
            Marge :{" "}
            <span className="font-semibold">
              {(((parseFloat(form.prixVente) - parseFloat(form.prixAchat)) / parseFloat(form.prixVente)) * 100).toFixed(1)}%
            </span>
            {" · "}
            {(parseFloat(form.prixVente) - parseFloat(form.prixAchat)).toLocaleString("fr-FR")} XAF
          </div>
        )}
      </div>

      {/* ── Stock ── */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Stock</h2>

        <div className="grid grid-cols-2 gap-3">
          {mode === "create" && !hasVariantes && (
            <div>
              <label className="form-label">Stock Initial</label>
              <input type="number" min="0" step="1"
                value={form.stockActuel} onChange={(e) => set("stockActuel", e.target.value)}
                className="form-input" />
              <p className="text-xs text-muted-foreground mt-1">Un mouvement ENTRÉE sera créé automatiquement</p>
            </div>
          )}
          {mode === "create" && hasVariantes && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
              <p className="text-sm font-medium text-primary">Stock total : {stockTotalVariantes} unités</p>
              <p className="text-xs text-muted-foreground mt-0.5">Calculé depuis les couleurs ci-dessus</p>
            </div>
          )}
          <div>
            <label className="form-label">Seuil Alerte</label>
            <input type="number" min="0" step="1"
              value={form.stockMinimum} onChange={(e) => set("stockMinimum", e.target.value)}
              className="form-input" />
            <p className="text-xs text-muted-foreground mt-1">Alerte quand stock passe sous ce seuil</p>
          </div>
          <div>
            <label className="form-label">Date d&apos;acquisition</label>
            <input type="date"
              value={form.dateAcquisition} onChange={(e) => set("dateAcquisition", e.target.value)}
              className="form-input" />
          </div>
        </div>
      </div>

      {/* ── Note barcode ── */}
      {mode === "create" && (
        <p className="text-xs text-muted-foreground bg-secondary rounded-xl px-4 py-2.5">
          🔖 Un code-barres EAN-13 sera généré automatiquement et assigné à ce produit.
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => router.back()} className="btn-ghost">Annuler</button>
        <button type="submit" disabled={loading || uploading} className="btn-primary px-6">
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> :
           mode === "create" ? "Ajouter au stock" : "Enregistrer les modifications"}
        </button>
      </div>
    </form>
  );
}
