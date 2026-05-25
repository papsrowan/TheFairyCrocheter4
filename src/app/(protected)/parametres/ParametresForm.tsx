"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Building2 } from "lucide-react";

interface Entreprise {
  id: string; nom: string; adresse: string; codePostal: string; ville: string;
  telephone?: string | null; email?: string | null; siteWeb?: string | null;
  siret?: string | null; tvaIntracommunautaire?: string | null;
  tauxTVADefaut: number; mentionsLegales?: string | null; piedPageFacture?: string | null;
}

interface Props {
  entreprise: Entreprise | null;
  canEdit: boolean;
}

export function ParametresForm({ entreprise, canEdit }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    nom: entreprise?.nom ?? "",
    adresse: entreprise?.adresse ?? "",
    codePostal: entreprise?.codePostal ?? "",
    ville: entreprise?.ville ?? "",
    telephone: entreprise?.telephone ?? "",
    email: entreprise?.email ?? "",
    siteWeb: entreprise?.siteWeb ?? "",
    siret: entreprise?.siret ?? "",
    tvaIntracommunautaire: entreprise?.tvaIntracommunautaire ?? "",
    tauxTVADefaut: String(entreprise?.tauxTVADefaut ?? 20),
    mentionsLegales: entreprise?.mentionsLegales ?? "",
    piedPageFacture: entreprise?.piedPageFacture ?? "",
  });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, tauxTVADefaut: parseFloat(form.tauxTVADefaut) }),
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informations principales */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Informations de l&apos;entreprise</h2>
        </div>

        <div>
          <label className="form-label">Nom de l&apos;entreprise *</label>
          <input required className="form-input" value={form.nom} onChange={f("nom")} disabled={!canEdit}
            placeholder="The Fairy Crocheter" />
        </div>

        <div>
          <label className="form-label">Adresse *</label>
          <input required className="form-input" value={form.adresse} onChange={f("adresse")} disabled={!canEdit}
            placeholder="123 rue des Artisans" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Code postal *</label>
            <input required className="form-input" value={form.codePostal} onChange={f("codePostal")} disabled={!canEdit}
              placeholder="75001" />
          </div>
          <div>
            <label className="form-label">Ville *</label>
            <input required className="form-input" value={form.ville} onChange={f("ville")} disabled={!canEdit}
              placeholder="Paris" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Téléphone</label>
            <input className="form-input" value={form.telephone} onChange={f("telephone")} disabled={!canEdit}
              placeholder="+33 1 23 45 67 89" />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={f("email")} disabled={!canEdit}
              placeholder="contact@exemple.com" />
          </div>
        </div>

        <div>
          <label className="form-label">Site web</label>
          <input className="form-input" value={form.siteWeb} onChange={f("siteWeb")} disabled={!canEdit}
            placeholder="https://exemple.com" />
        </div>
      </div>

      {/* Informations légales & fiscales */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold">Informations légales & fiscales</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">SIRET</label>
            <input className="form-input" value={form.siret} onChange={f("siret")} disabled={!canEdit}
              placeholder="12345678901234" />
          </div>
          <div>
            <label className="form-label">N° TVA intracommunautaire</label>
            <input className="form-input" value={form.tvaIntracommunautaire} onChange={f("tvaIntracommunautaire")} disabled={!canEdit}
              placeholder="FR12345678901" />
          </div>
        </div>

        <div>
          <label className="form-label">Taux TVA par défaut (%)</label>
          <input type="number" min="0" max="100" step="0.001" className="form-input max-w-[140px]"
            value={form.tauxTVADefaut} onChange={f("tauxTVADefaut")} disabled={!canEdit} />
        </div>
      </div>

      {/* Facturation */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-semibold">Facturation</h2>

        <div>
          <label className="form-label">Mentions légales</label>
          <textarea className="form-textarea" rows={3} value={form.mentionsLegales} onChange={f("mentionsLegales")} disabled={!canEdit}
            placeholder="Mentions légales à afficher sur les factures..." />
        </div>

        <div>
          <label className="form-label">Pied de page facture</label>
          <textarea className="form-textarea" rows={2} value={form.piedPageFacture} onChange={f("piedPageFacture")} disabled={!canEdit}
            placeholder="Merci pour votre confiance..." />
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">✓ Paramètres sauvegardés</span>}
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-muted-foreground">Vous n&apos;avez pas les permissions pour modifier ces paramètres.</p>
      )}
    </form>
  );
}
